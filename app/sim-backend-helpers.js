var fs = require('fs');
var NodeRSA = require('node-rsa');
var os = require('os');
var lockFile = require('lockfile');

/**
 * static helpers for backend
 *
 * @copyright  Copyright (c) Tobias Zeising (http://www.aditu.de)
 * @license    GPLv3 (http://www.gnu.org/licenses/gpl-3.0.html)
 */
sim.backend.helpers = {

    /**
     * all users are registered in a single json file. This method updates or adds
     * an entry of the current user.
     * @param file (string) The path and filename of the userfile
     * @param key (NodeRSA) RSA Key for writing public key into userfile
     * @param ip (string) IP Address of current user
     * @param avatar (string) base64 encoded avatar file
     * @param rooms (Array of strings) all rooms this user is in
     * @param success (function) callback with all current fetched users
     */
    updateUserlist: function(file, key, ip, avatar, rooms, success) {
        sim.backend.helpers.readJsonFile(file, function(users) {
            var currentuser = sim.backend.helpers.getUsername();
            var now = new Date().getTime();
            
            // entry for current user
            var userEntry = {
                username: currentuser,
                timestamp: now,
                key: key,
                ip: ip,
                port: config.chatport,
                rooms: rooms
            };
            
            // avatar for current user
            if (typeof avatar != 'undefined')
                userEntry.avatar = avatar;
            
            // remove orphaned user entries
            var newUserlist = [];
            for(var i=0; i<users.length; i++) {
                // current user will be added later
                if (users[i].username == currentuser)
                    continue;
                
                // only save active users
                if (users[i].timestamp + config.user_timeout > now)
                    newUserlist[newUserlist.length] = users[i];
            }
            
            // add current user
            newUserlist[newUserlist.length] = userEntry;
            
            // write back userfile
            sim.backend.helpers.writeJsonFile(file, newUserlist);
            
            // execute success method
            success(newUserlist);
        });
    },


    /**
     * returns new RSA Key Pair
     * @return (NodeRSA) new RSA keypair
     */
    generateKeypair: function() {
        return new NodeRSA({b: 2048});
    },
    
    
    /**
     * returns current ip
     * @return (string) the ip of the current user
     */
    getIp: function() {
        var ifaces=os.networkInterfaces();
        var ip = false;
        for (var dev in ifaces) {
            ifaces[dev].forEach(function(details){
                if (details.family=='IPv4' && details.address!="127.0.0.1")
                    ip = details.address;
            });
        }
        return ip;
    },
    
    
    /**
     * returns current systems username
     * @return (string) the username of the current user (from System environment variables)
     */
    getUsername: function() {
        if (typeof config.username == "undefined")
            return process.env.USERNAME;
        else
            return config.username;
    },
    
    
    /**
     * write object as json in file
     * @param file (string) filename for writing the content
     * @param content (object) will be json encoded written into file
     */
    writeJsonFile: function(file, content) {
        fs.writeFile(file, JSON.stringify(content, null, 4), 'utf8', function(err) {
            if(err)
                sim.backend.error('Fehler beim Schreiben der Userliste: ' + err);
        }); 
    },
    
    
    /**
     * read json encoded file and return as object
     * @param file (string) path and filename
     * @param callback (function) after successfully reading and json parsing content of file
     */
    readJsonFile: function(file, callback) {
        fs.readFile(file, 'utf8', function (err, data) {
            var res = [];
            if (err) {
                callback(res);
                return;
            }

            try {
                res = JSON.parse(data);
            } catch (er) {
                // do nothing, return []
            }

            callback(res);
        });
    },

    
    /**
     * read file and return as ByteBuffer
     * @param file (string) path and filenam
     * @param callback (function) contains file data
     */
    readFile: function(file, callback) {
        fs.readFile(file, function (err, data) {
            if (err) {
                sim.backend.error('Datei konnte nicht geladen werden');
                return;
            }

            callback(data);
        });
    },
    
    
    /**
     * get lock for user list file.
     * @param callback (function) callback after locking successfully or not successfully the file
     */
    lock: function(callback) {
        lockFile.lock(config.lock_file, { stale: config.lock_stale }, callback);
    },
    
    
    /**
     * release lock for user list file
     */
    unlock: function() {
        lockFile.unlock(config.lock_file, function(err) {});
    },
    
    
    /**
     * encrypt with RSA
     * @return encrypted string
     * @param key (string) public key for encryption
     * @param data (mixed) data for encryption
     */
    encrypt: function(key, data) {
        return key.encrypt(data, 'base64');
    },
    
    
    /**
     * decrypt with RSA
     * @return decrypted string
     * @param key (string) public key for decryption
     * @param data (mixed) data for decryption
     */
    decrypt: function(key, data) {
        return key.decrypt(data).toString();
    },
    
    
    /**
     * search user in userlist
     * @return (object or boolean) user object or false if none was found
     * @param userlist (array of object) list with all users (object with property username)
     * @param user (string) username which will be searched
     */
    getUser: function(userlist, user) {
        user = user.toLowerCase();
        for(var i=0; i<userlist.length; i++) {
            if (userlist[i].username.toLowerCase() == user) {
                return userlist[i];
            }
        }
        return false;
    },
    
    
    /**
     * removes a room from given list
     * @return (array) list without given room
     * @param list (array) with objects with property name
     * @param room (string) roomname which should be removed
     */
    removeRoomFromList: function(list, room) {
        var newList = [];
        for(var i=0; i<list.length; i++) {
            if (list[i].name == room)
                continue;
            newList[newList.length] = list[i];
        }
        return newList;
    },
    
    
    /**
     * returns true if user is in list
     * @return (boolean) true if user was found, false otherwise
     * @param list (array) with users
     * @param room (string) roomname in which the user should be
     */
    isUserInRoomList: function(list, room) {
        for (var i=0; i<list.length; i++) {
            if (list[i].name == room) {
                return true;
            }
        }
        return false;
    },
    
    
    /**
     * returns all users, which are not in list but in compare
     * @return (array) list with all users, which are in the first list but not in the second
     * @param list (array) with users with property username
     * @param room (array) with users with property username
     */
    getUsersNotInListOne: function(list, compare) {
        var notInList = [];
        for(var i=0; i<compare.length; i++) {
            var inList = false;
            for(var n=0; n<list.length; n++) {
                if(compare[i].username==list[n].username)
                    inList = true;
            }
            if (inList==false)
                notInList[notInList.length] = compare[i];
        }
        return notInList;
    }
};