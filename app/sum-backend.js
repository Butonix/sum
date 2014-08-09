if (typeof gui == 'undefined') gui = require('nw.gui');
if (typeof path == 'undefined') path = require('path');

/**
 * backend handles messaging, userlist management, update of userlist and all nodejs/node webkit tasks
 *
 * @copyright  Copyright (c) Tobias Zeising (http://www.aditu.de)
 * @license    GPLv3 (http://www.gnu.org/licenses/gpl-3.0.html)
 */
define('sum-backend', Class.extend({

    /**
     * backends helpers
     */
    backendHelpers: injected('sum-backend-helpers'),


    /**
     * backends client
     */
    backendClient: injected('sum-backend-client'),


    /**
     * backends userlist updater
     */
    backendUserlist: injected('sum-backend-userlist-file'),


    /**
     * backends server
     */
    backendServer: injected('sum-backend-server'),


    /**
     * don't send notifications on first update run on program startup
     */
    firstUpdate: true,
    
    
    /**
     * current version
     */
    version: '',


    /**
     * RSA Key
     */
    key: false,


    /**
     * Current ip
     */
    ip: false,


    /**
     * current port for chat communication
     */
    port: false,


    /**
     * current userlist
     */
    userlist: [],


    /**
     * current roomlist
     */
    roomlist: [],


    /**
     * rooms with invitations
     */
    invited: [],


    /**
     * saves all conversations
     */
    conversations: {},


    /**
     * enable/disable notifications
     */
    enableNotifications: true,


    
    
    ////////////////////
    // initialization //
    ////////////////////
    
    
    /**
     * initialize backend
     */
    initialize: function() {
        // set userlist handling
        if (config.userlist === 'web')
            this.backendUserlist = inject('sum-backend-userlist-web');
    
        // get current version
        var packagejson = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
        this.version = packagejson.version;

        // initial generate rsa keys
        this.key = this.backendHelpers.generateKeypair();

        // set ip
        this.ip = this.backendHelpers.getIp();

        // init node webkit tray icon
        this.initTray();

        // load rooms where user was in on last logout
        this.roomlist = this.backendHelpers.loadRoomlist();

        // start backend server for chat communication
        var that = this;
        this.backendServer.start(function(port) {
            // save port which server uses for userfile
            that.port = port;

            // create/update userfile (holds additional information as avatar, key, ip, ...)
            that.backendUserlist.userlistUpdateUsersOwnFile(that.ip, that.port, that.key, that.backendHelpers.loadAvatar(), that.version, function() {
                // afterwards start userlist updater
                that.backendUserlist.userlistUpdateTimer();
            });
        });
    },


    /**
     * Initialize tray icon
     */
    initTray: function() {
        // create a tray icon
        var tray = new gui.Tray({ title: 'Tray', icon: 'app/favicon.png', tooltip: 'S Ultimate Messenger' });

        // give it a menu
        var menu = new gui.Menu();

        // open debugger
        menu.append(new gui.MenuItem({ type: 'normal', label: 'Debug', click: function() {
            gui.Window.get().showDevTools();
        } }));

        // quit app
        menu.append(new gui.MenuItem({ type: 'normal', label: 'Beenden', click: function() {
            gui.App.quit();
        } }));
        tray.menu = menu;

        // click on tray icon = focus window
        tray.on('click', function() {
            gui.Window.get().show();
            gui.Window.get().focus();
        });
    },


    


    ////////////////////////////////////////////
    // callback registration for the frontend //
    ////////////////////////////////////////////

    /**
     * register callback for a new online user
     */
    onRoomInvite: function(callback) {
        this.roomInvite = callback;
    },

    /**
     * register callback for a new online user
     */
    onUserOnlineNotice: function(callback) {
        this.userOnlineNotice = callback;
    },

    /**
     * register callback for a user goes offline
     */
    onUserOfflineNotice: function(callback) {
        this.userOfflineNotice = callback;
    },

    /**
     * register callback for a user has been removed
     */
    onUserRemovedNotice: function(callback) {
        this.userRemovedNotice = callback;
    },

    /**
     * register callback for incoming new message
     */
    onNewMessage: function(callback) {
        this.newMessage = callback;
    },

    /**
     * register callback for room list update
     */
    onGetRoomlistResponse: function(callback) {
        this.getRoomlistResponse = callback;
    },

    /**
     * register callback for user list update
     */
    onGetUserlistResponse: function(callback) {
        this.getUserlistResponse = callback;
    },

    /**
     * register callback for getting converstion
     */
    onGetContentResponse: function(callback) {
        this.getContentResponse = callback;
    },

    /**
     * register callback for error message
     */
    onError: function(callback) {
        this.error = callback;
    },

    /**
     * register callback for error message
     */
    onHasUserlistUpdate: function(callback) {
        this.hasUserlistUpdate = callback;
    },

    /**
     * register callback for when user is removed
     */
    onUserIsRemoved: function(callback) {
        this.userIsRemoved = callback;
    },


    /**
     * register callback for changing current conversation
     */
    onSwitchConversation: function(callback) {
        this.switchConversation = callback;
    },
    
    /**
     * register callback for rerendering messages
     */
    onRerenderMessage: function(callback) {
        this.rerenderMessage = callback;
    },


    

    ////////////////////////////
    // functions for frontend //
    ////////////////////////////

    
    // notification handling
    
    /**
     * send system notification
     * @param image (string) little image shown in the notification
     * @param title (string) title of the notification
     * @param text (string) text of the notification
     * @param conversation (string) conversation for showing on click on notification window
     */
    notification: function(image, title, text, conversation) {
        if(this.enableNotifications===true) {
            var that = this;
            window.LOCAL_NW.desktopNotifications.notify(image, title, text, function() {
                gui.Window.get().show();
                if (typeof conversation != 'undefined') {
                    that.switchConversation(conversation);
                }
            });
        }
    },
    
    
    /**
     * enable/disable notifications
     * @param enable (boolean) enable/disable system notifications
     */
    notifications: function(enable) {
        this.enableNotifications = enable;
    },
    
    

    // user handling
    
    
    /**
     * update frontend with current userlist. onGetUserlistResponse will be executed.
     * @param conversation (string) the current conversation (room or user or nothing)
     */
    updateUserlist: function(conversation) {
        if(typeof this.getUserlistResponse != "undefined") {

            // per default: return all
            var users = this.userlist;

            // filter by room if user has selected a room
            if (typeof conversation != 'undefined' && conversation !== false) {
                // given conversation is a room and not a user?
                if (this.getUser(conversation)===false) {
                    users = this.getUsersInRoom(conversation);
                }
            }

            // send userlist to frontend
            this.getUserlistResponse(users);
        }
    },

    
    /**
     * returns array with all known users
     * @return (Array) of all users
     * @param withoutCurrentUser (boolean) include current user in result or not
     */
    getAllUsers: function(withoutCurrentUser) {
        var currentuser = this.backendHelpers.getUsername();
        var users = [];
        for(var i=0; i<this.userlist.length; i++) {
            if (withoutCurrentUser === true && this.userlist[i].username == currentuser)
                continue;
            users[users.length] = this.userlist[i];
        }
        return users;
    },
    
    
    /**
     * returns array with all online users
     * @return (Array) of all online users
     */
    getAllOnlineUsers: function() {
        return this.backendHelpers.getUsersByStatus(this.getAllUsers(true), 'online');
    },


    /**
     * get user from userlist or false if user not available
     * @return (object) returns given user with detail informations
     * @param name (string) the name of the user
     */
    getUser: function(name) {
        return this.backendHelpers.getUser(this.userlist, name);
    },
    
    
    /**
     * returns true if given user is current user.
     * @return (boolean) true or false
     * @param (string) the name of the user
     */
    isCurrentUser: function(user) {
        return this.backendHelpers.getUsername() === user;
    },
    
    
    
    
    // avatar handling
    
    /**
     * save avatar in local storage
     * @param avatar (string) base64 encoded avatar
     */
    saveAvatar: function(avatar) {
        window.localStorage.avatar = avatar;
        var that = this;
        this.backendUserlist.userlistUpdateUsersOwnFile(this.ip, this.port, this.key, avatar, this.version, function() {
            that.backendUserlist.userlistUpdateTimer(this);
        });
    },


    /**
     * get avatar of a given user or default avatar avatar.png
     * @return (string) base64 encoded avatar of the user (if available)
     * @param username (string) the username
     */
    getAvatar: function(username) {
        var avatar = "avatar.png";
        for(var i=0; i<this.userlist.length; i++) {
            if (this.userlist[i].username==username && typeof this.userlist[i].avatar != 'undefined') {
                avatar = this.userlist[i].avatar;
                break;
            }
        }
        return avatar;
    },

    
    /**
     * get file from filesystem
     * @param file (string) path and filenam
     * @param success (function) contains file data
     * @param error (function) will be executed on error
     */
    getFile: function(file, success, error) {
        this.backendHelpers.readFile(file, success, error);
    },
    
    
    
    // room handling
    

    /**
     * update frontend with current roomlist. onGetRoomlistResponse will be executed.
     */
    updateRoomlist: function() {
        if(typeof this.getRoomlistResponse != "undefined") {
            var rooms = [ { name: config.room_all} ]     // room: all users
                        .concat(this.roomlist)    // rooms user is in
                        .concat(this.invited);    // rooms user is invited
            this.getRoomlistResponse(rooms);
        }
    },

    
    /**
     * returns all users which are in a given room
     * @return (Array) of all users in a given room
     * @param room (string) roomname
     */
    getUsersInRoom: function(room) {
        // room for all users?
        if (room==config.room_all)
            return this.userlist;

        // a user created room
        var users = [];
        for(var i=0; i<this.userlist.length; i++) {
            for(var n=0; n<this.userlist[i].rooms.length; n++) {
                if (this.userlist[i].rooms[n].name==room) {
                    users[users.length] = this.userlist[i];
                }
            }
        }
        return users;
    },


    /**
     * decline room invitation
     * @param room (string) roomname
     */
    declineInvitation: function(room) {
        // send decline message to invitor
        var roomObj = this.backendHelpers.getRoom(this.invited, room);
        var user = this.backendHelpers.getUser(this.userlist, roomObj.invited);
        var message = {
            'type': 'invite-decline',
            'room': room,
            'sender': this.backendHelpers.getUsername(),
            'receiver': user.username
        };
        this.backendClient.send(
            user,
            this.backendHelpers.signMessage(message, this.key),
            function() {},
            this.error);
        
        // remove from invite roomlist
        this.invited = this.backendHelpers.removeRoomFromList(this.invited, room);
        this.updateRoomlist();
    },


    /**
     * accept room invitation
     * @param room (string) roomname
     */
    acceptInvitation: function(room) {
        // send acccept message to invitor
        var roomObj = this.backendHelpers.getRoom(this.invited, room);
        var user = this.backendHelpers.getUser(this.userlist, roomObj.invited);
        var message = {
            'type': 'invite-accept',
            'room': room,
            'sender': this.backendHelpers.getUsername(),
            'receiver': user.username
        };
        this.backendClient.send(
            user,
            this.backendHelpers.signMessage(message, this.key),
            function() {},
            this.error);
            
        // remove room from invitation list
        this.invited = this.backendHelpers.removeRoomFromList(this.invited, room);

        // check still in room?
        if (this.backendHelpers.isUserInRoomList(this.roomlist, room)) {
            this.error('Du bist bereits in dem Raum');
            return;
        }

        // add room to roomlist
        this.roomlist[this.roomlist.length] = { 'name': room };
        this.backendHelpers.saveRoomlist(this.roomlist);
        this.updateRoomlist();
    },


    /**
     * add new room
     * @param room (string) roomname
     * @param users (array) array of all usernames
     */
    addRoom: function(room, users) {
        room = room.trim();
        this.inviteUsers(room, users);
        this.roomlist[this.roomlist.length] = { 'name': room };
        this.backendHelpers.saveRoomlist(this.roomlist);
        this.updateRoomlist();
    },


    /**
     * invite new users to room
     * @param room (string) roomname
     * @param users (array) array of all usernames
     */
    inviteUsers: function(room, users) {
        if (typeof users == 'undefined' || users === null)
            users = [];
        var usersFromList = [];
        var i = 0;
        for (i=0; i<users.length; i++)
            usersFromList[usersFromList.length] = this.getUser(users[i]);
        users = usersFromList;

        var message = {
            'type': 'invite',
            'room': room,
            'sender': this.backendHelpers.getUsername(),
            'receiver': ''
        };

        // send invite to all users
        for (i=0; i<users.length; i++) {
            message.receiver = users[i].username;
            this.backendClient.send(users[i], this.backendHelpers.signMessage(message, this.key), function() {}, this.error);
            this.renderSystemMessage(users[i].username + ' eingeladen', room);
        }
    },


    /**
     * leave room
     * @param room (string) roomname
     */
    leaveRoom:function(room) {
        var newRoomlist = [];
        for (var i=0; i<this.roomlist.length; i++) {
            if (this.roomlist[i].name != room) {
                newRoomlist[newRoomlist.length] = this.roomlist[i];
            }
        }
        this.roomlist = newRoomlist;
        this.backendHelpers.saveRoomlist(this.roomlist);
        this.updateRoomlist();
    },

    
    /**
     * check whether a room already exists or not
     * @return (boolean) true or false
     * @param room (string) roomname
     */
    doesRoomExists: function(room) {
        if (room == config.room_all)
            return true;

        room = room.toLowerCase();
        for(var i=0; i<this.userlist.length; i++) {
            for(var n=0; n<this.userlist[i].rooms.length; n++) {
                if (this.userlist[i].rooms[n].name.toLowerCase() == room) {
                    return true;
                }
            }
        }
        return false;
    },
    
    
    
    // conversation handling
    
    
    /**
     * update frontend with given conversation. id is username or roomname. onGetContentResponse will be executed.
     * @param id (string) the conversation (room or user or nothing)
     */
    getConversation: function(id) {
        if(typeof this.getContentResponse != "undefined") {
            var conversation = (typeof this.conversations[id] != "undefined") ? this.conversations[id] : [];
            this.getContentResponse(id, conversation);
        }
    },

    
    /**
     * clear given conversation
     * @param (string) conversation for purging
     */
    clearConversation: function(conversation) {
        this.conversations[conversation] = [];
    },


    /**
     * render system message
     * @param text (string) message
     * @param conversation (string) target conversation
     */
    renderSystemMessage: function(text, conversation) {
        // get conversation
        if (typeof this.conversations[conversation] == 'undefined')
            this.conversations[conversation] = [];
        var con = this.conversations[conversation];

        // add system message
        con[con.length] = {
            id: this.backendHelpers.genereateGUID(),
            type: 'system',
            text: text.escape().replace(/\&lt;br \/\&gt;/g, '<br />')
        };
        this.getConversation(conversation);
    },
    

    /**
     * send new message.
     * @param message (object) the message
     */
    sendMessage: function(message) {
        // get user or users of a given room
        var users = this.backendHelpers.getUser(this.userlist, message.receiver);
        if (users===false) {
            users = this.getUsersInRoom(message.receiver);
        } else {
            users = [ users ];
        }

        // no room or user found?
        if (users.length===0) {
            this.error('Ungültiger Benutzer oder Raum');
            return;
        }

        // user is offline?
        if (users.length==1 && users[0].status == 'offline') {
            this.error('Der Benutzer ist nicht online');
            return;
        }

        // create new message
        var currentuser = this.backendHelpers.getUsername();
        message = $.extend(message, {
            'id': this.backendHelpers.genereateGUID(),
            'sender': currentuser
        });

        // save message in own conversation
        if (typeof this.conversations[message.receiver] == 'undefined')
            this.conversations[message.receiver] = [];
        var conversation = this.conversations[message.receiver];
        conversation[conversation.length] = $.extend({}, message, { datetime: new Date().getTime() });
        this.getConversation(message.receiver);

        // remove file path
        if (message.type === 'file-invite') {
            message = $.extend(message, { 'path': path.basename(message.path) });
        }
        
        // send message to all users
        var that = this;
        for (var i=0; i<users.length; i++) {
            // don't send message to offline users
            if (users[i].status == 'offline')
                continue;

            // don't send message to this user
            if (users[i].username == currentuser)
                continue;

            // send message
            this.backendClient.send(users[i], this.backendHelpers.signMessage(message, this.key), function() {
                that.getConversation(message.receiver);
            }, this.error);
        }
    },
    
    
    /**
     * returns message from conversation
     * @return (boolean|object) message or false
     * @param (string) id of message
     */
    getMessage: function(id) {
        return this.backendHelpers.findMessage(this.conversations, id);
    },

    
    // file send handling
    
    
    /**
     * sends file invitation
     * @param (string) file path of file
     * @param (string) user or room for sending the invitation
     */
    sendFileInvite: function(file, user) {
        // file available?
        if (fs.existsSync(file) === false)
            this.error('Fehler beim Zugriff auf die Datei');
                
        // file size?
        var fileSize = fs.statSync(file).size;
        
        // send
        var invite = {
            'type': 'file-invite',
            'size': fileSize,
            'receiver': user,
            'path': file
        };
        this.sendMessage(invite);
    },
    
    
    /**
     * cancel file invitation
     * @param (string) messageId for canceling
     */
    cancelFileInvite: function(messageId) {
        var message = this.backendHelpers.findMessage(this.conversations, messageId);
        if (message === false)
            return;
        
        message.canceled = true; // this updates also the message inside conversations
        this.rerenderMessage(message);
        
        // send cancel invitation to all users
        if (message.sender === this.backendHelpers.getUsername()) {
            this.sendMessage({
                'type': 'file-invite-cancel',
                'receiver': message.receiver,
                'file': messageId
            });
        }
    },
    
    
    /**
     * download file from user and save it
     * @param params (object) params for file download
     */
    saveFile: function(params) {
        var user = this.getUser(params.message.sender);
        if (user === false || user.status === 'offline') {
            this.error('user not found or user offline');
            return;
        }
        
        // download file
        this.backendClient.file({
            user:     user, 
            sender:   this.backendHelpers.getUsername(),
            file:     params.message.id, 
            target:   params.message.saved, 
            size:     params.message.size, 
            success:  params.success, 
            error:    params.error, 
            progress: params.progress,
            cancel:   params.cancel
        });
    },
    
    
    /**
     * cancel running file download
     * @param (string) messageId download id
     */
    cancelFileDownload: function(messageId) {
        this.backendClient.cancelList[this.backendClient.cancelList.length] = messageId;
    },
    
    
    /**
     * will be called by server after successfully sending a file to another user
     * @param (string) messageId of file invite
     * @param (string) sender who fetched this file
     */
    finishedFileRequest: function(messageId, sender) {
        var message = this.backendHelpers.findMessage(this.conversations, messageId);
        if (typeof message.loaded === 'undefined')
            message.loaded = [];
        if ($.inArray(sender, message.loaded) === -1)
            message.loaded[message.loaded.length] = sender;
        this.rerenderMessage(message);
    },
    

    /**
     * open downloaded file
     * @param (string) messageId download id
     */
    openFile: function(messageId) {
        var message = this.backendHelpers.findMessage(this.conversations, messageId);
        gui.Shell.openExternal(message.saved);
    },
    
    
    /**
     * open url
     * @param (string) given url
     */
    openUrl: function(url) {
        gui.Shell.openExternal(url);
    },
    
    
    
    // Application handling
    
    
    /**
     * quit application
     */
    quit: function() {
        gui.App.quit();
    },


    /**
     * close application
     */
    close: function() {
        gui.Window.get().hide();
    },


    /**
     * check if newer version of this application is available
     * @param callback (function) will be executed if newer version was found
     */
    isNewerVersionAvailable: function(callback) {
        var that = this;
        this.backendHelpers.readFile(config.version_file, function(given) {
            given = given.toString();
            if (that.backendHelpers.isVersionNewer(that.version, given))
                callback(given);
        }, function() { /* on error do nothing */ });
    },
    
    
    /**
     * show notification for users which are now online/offline/removed
     * @param (array) newuserlist
     */
    showOnlineOfflineNotifications: function(newuserlist) {
        if (this.firstUpdate === false) {
            var online = this.backendHelpers.getUsersNotInListOne(
                this.backendHelpers.getUsersByStatus(this.userlist, 'online'), 
                this.backendHelpers.getUsersByStatus(newuserlist, 'online')
            );
            var offline = this.backendHelpers.getUsersNotInListOne(
                this.backendHelpers.getUsersByStatus(this.userlist, 'offline'), 
                this.backendHelpers.getUsersByStatus(newuserlist, 'offline')
            );
            var removed = this.backendHelpers.getUsersNotInListOne(newuserlist, this.userlist);
            var i = 0;
            var message;
            
            if (typeof this.userOnlineNotice != 'undefined')
                for (i = 0; i < online.length; i++) {
                    message = online[i].username + ' ist jetzt online';
                    this.renderSystemMessage(message, online[i].username);
                    this.renderSystemMessage(message, config.room_all);
                    this.userOnlineNotice(online[i].avatar, online[i].username);
                }

            if (typeof this.userOfflineNotice != 'undefined')
                for (i = 0; i < offline.length; i++) {
                    message = offline[i].username + ' ist jetzt offline';
                    this.renderSystemMessage(message, offline[i].offline);
                    this.renderSystemMessage(message, config.room_all);
                    this.userOfflineNotice(offline[i].avatar, offline[i].username);
                }

            if (typeof this.userRemovedNotice != 'undefined')
                for (i = 0; i < removed.length; i++) {
                    this.userRemovedNotice(removed[i].avatar, removed[i].username);
                }
        }
        this.firstUpdate = false;
    }
    
}));
