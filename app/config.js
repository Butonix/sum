var config = {
    // path of user file
    user_file: "c:/tmp/userfile.json",
    
    // file per user where avatar and key will be stored
    user_file_extended: "c:/tmp/#",
    
    // path of lock file
    lock_file: "c:/tmp/userfile.lock",
    
    // remove users from list after ms inactivity
    user_timeout: 60000,
    
    // update every n seconds users entry in userlist file
    user_list_update_intervall: 3000,
    
    // port for chat communication
    chatport: 60123,
    
    // max age in milliseconds of lock file
    lock_stale: 3000,
    
    // retry in minimum random ms when file is locked
    lock_retry_minimum: 3000,
    
    // retry in maximum random ms when file is locked
    lock_retry_maximum: 5000,
    
    // name of the room for all chatters
    room_all: "Alle"
};