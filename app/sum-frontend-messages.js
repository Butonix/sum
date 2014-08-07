/**
 * messages for the frontend
 *
 * @copyright  Copyright (c) Andreas Schiefele
 * @license    GPLv3 (http://www.gnu.org/licenses/gpl-3.0.html)
 */
define('sum-frontend-messages', Class.extend({

    /**
     * the current backend
     */
    backend: injected('sum-backend'),


    /**
     * the current frontend helpers
     */
    frontendHelpers: injected('sum-frontend-helpers'),


    /**
     * renders a single message
     * @param message given message for rendering
     * @returns {string} rendered message
     */
    renderMessage: function (message) {
        var markup = '<li id="' + message.id + '" class="entry">';
        
        // render message depending on his type
        if(message.type === 'text-message' || message.type === 'message')
            markup += this.renderTextMessage(message);
        else if(message.type === 'codeblock-message')
            markup += this.renderCodeBlockMessage(message);
        else if(message.type === 'system')
            markup += this.renderSystemMessage(message);
        else if(message.type === 'file-invite')
            markup += this.renderFileInvite(message);
        
        markup += '</li>';
        return markup;
    },


    /**
     * renders a text message
     * @param message given message
     * @param escape (boolean) true for escaping text, false for not
     * @returns {string} text message markup
     */
    renderTextMessage: function (message, escape) {
        var text = message.text;

        if (typeof escape == 'undefined' || escape === true) {
            text = text.escape();
            text = this.frontendHelpers.urlify(text);
            text = this.frontendHelpers.emoticons(text);
        }

        var markup = '<div class="entry-avatar">\
            <img src="' + this.backend.getAvatar(message.sender) + '" class="avatar" />\
        </div>\
        <div class="entry-contentarea" lang="de">\
            <span class="entry-sender">' + message.sender.escape() + '</span>\
            <span class="entry-datetime" title="' + new Date(message.datetime).toLocaleString() + '">\
                ' + this.frontendHelpers.dateAgo(message.datetime) + '\
            </span>\
            <div class="entry-content">\
                ' + text + '\
            </div>\
        </div>';
        
        return markup;
    },


    /**
     * renders source code block
     * @param message source code
     * @returns {string} source code block markup
     */
    renderCodeBlockMessage: function (message) {
        var text = message.text;

        // format code
        if (message.language != 'undefined' && message.language != 'auto')
            text = hljs.highlight(message.language, text).value;
        else
            text = hljs.highlightAuto(text).value;

        var formattedMessage = $.extend({}, message);
        formattedMessage.text = '<pre><code class="has-numbering">' + text + '</code></pre>';
        return this.renderTextMessage(formattedMessage, false);
    },
    
    
    /**
     * renders file invite
     * @param message source code
     * @returns {string} source code block markup
     */
    renderFileInvite: function (message) {
        message.text = message.path + ' wurde zum Download bereitgestellt';
        
        // render sent invite
        if(this.backend.isCurrentUser(message.sender)) {
            if (typeof message.loaded !== 'undefined') {
                message.text += '<ul class="entry-file-loaded">';
                $.each(message.loaded, function(index, user) {
                    message.text = message.text + '<li>' + user.escape() + '</li>';
                });
                message.text += '</ul>';
            }
            
            if (typeof message.canceled === 'undefined') {
                message.text = message.text + '<input class="cancel entry-file-cancel" type="button" value="abbrechen" />';
            }
        
        // render received invite
        } else {
            if (typeof message.progress === 'number') {
                message.text = message.text + '<div class="entry-file-progress" style="width:' + message.progress + '%"></div>';
            }
            
            if (typeof message.saved === 'undefined') {
                message.text = message.text + '<input class="save" type="button" value="download" /> <input class="cancel" type="button" value="abbrechen" />';
            } else {
                message.text = message.text + ' Datei wurde heruntergeladen: <span class="open">' + message.path + '</span>';
            }
        }

        return this.renderTextMessage(message, false);
    },
    
    
    /**
     * renders command result
     * @param message command result
     * @returns {string} command markup
     */
    renderSystemMessage: function(message) {
        var markup = '<div class="entry-contentarea" lang="de">\
            <div class="entry-status">\
                ' + message.text + '\
            </div>';
        return markup;
    }
}));