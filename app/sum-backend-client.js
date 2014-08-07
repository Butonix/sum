if (typeof base64  == 'undefined') base64  = require('base64-stream');
if (typeof fs == 'undefined') fs = require('fs');

/**
 * client for sending encrypted chat messages and status updates
 *
 * @copyright  Copyright (c) Tobias Zeising (http://www.aditu.de)
 * @license    GPLv3 (http://www.gnu.org/licenses/gpl-3.0.html)
 */
define('sum-backend-client', Class.extend({

    /**
     * backends helpers
     */
    backendHelpers: injected('sum-backend-helpers'),

    
    /**
     * list of message id for canceling download
     */
    cancelList: [],
    

    /**
     * send new message or information to another user
     * @param receiver (mixed) the target user (with ip, port and key)
     * @param message (mixed) the message as object (depends from the content of the message)
     * @param success (function) callback on success
     * @param error (function) callback on error
     */
    send: function(receiver, message, success, error) {
        // encrypt message
        var encMessage = this.backendHelpers.encrypt(new NodeRSA(receiver.key), message);

        // send message
        var request = http.request({
            host: receiver.ip,
            port: receiver.port,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Txype': 'application/json',
                'Content-Length': encMessage.length
            }
        }, function(res) {
            // result is ok? execute success
            if(res.statusCode == 200) {
                if (typeof success != 'undefined') {
                    success(res);
                }
            } else {
                error('Bei der Kommunikation mit ' + receiver.username.escape() + ' ist ein Fehler aufgetreten');
            }
        });

        // on error
        request.on('error', function(e) {
            error('Der Benutzer ' + receiver.username.escape() + ' ist nicht erreichber. Fehler: ' + e);
        });

        request.write(encMessage);
        request.end();
    },
    
    
    /**
     * load file from given receiver.
     * @return (binary) file
     * @param params (object) params for file download
     */
    file: function(params) {
        var that = this;
        this.send(
            params.user,
            {
                type: 'file-request',
                file: params.file
            },
            function(response) {
                // decryption stream (password is file id, thats save because file id will be sent rsa encrypted)
                var base64 = require('base64-stream');
                var crypto = require('crypto');
                var aes = crypto.createDecipher('aes-256-cbc', crypto.createHash('sha256').update(params.file).digest('hex'));
                            
                // file stream
                var file = fs.createWriteStream(params.target);
                var base64reader = base64.decode();
                response.pipe(base64reader)  // decode base64
                        .pipe(aes)              // decrypt
                        .pipe(file);            // write in file
                
                // on data chunk received
                aes.on('data', function (chunk) {
                    $.each(that.cancelList, function(index, item) {
                        if (item === params.file) {
                            base64reader.emit('end');
                            base64reader.emit('close');
                            aes.emit('end');
                            aes.emit('close');
                            response.emit('end');
                            response.emit('close');
                            params.cancel();
                            return false;
                        }
                    });
                
                    if (fs.existsSync(params.target) === false)
                        return;
                    
                    var fileSize = fs.statSync(params.target).size;
                    var percent = Math.floor((fileSize / params.size) * 100);
                    if (typeof params.progress !== 'undefined' && percent % 5 === 0)
                        params.progress(percent);
                });
                
                // on last data chunk received: file load complete
                aes.on('end', function (chunk) {
                    if (typeof params.success !== 'undefined')
                        params.success();
                });
            },
            params.error
        );
    }
}));
