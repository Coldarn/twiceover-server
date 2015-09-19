// Parses strings of the form "First Last <email@example.com>" into name and email parts
'use strict';

function tryParse(str) {
    var parts = /\s*([^<]*?)\s*<(([^@]+).+)>\s*$/.exec(str);
    var name = parts && (parts[1] || parts[3]) || '';
    var email = parts && parts[2] || '';

    return email ? { name: name.trim(), email: email.trim() } : null;
}

var proto = {
    is: function (otherUser) {
        if (proto.isPrototypeOf(otherUser)) {
            return otherUser.email.toLocaleLowerCase() === this.email.toLocaleLowerCase();
        }
        var other = User(otherUser);
        return other.email.toLocaleLowerCase() === this.email.toLocaleLowerCase();
    },
    
    getName: function () {
        return this.name || this.email;
    },

    toString: function () {
        return this.name ? (this.name + ' <' + this.email + '>') : this.email;
    },

    getAvatarUrl: function (size) {
        return 'http://www.gravatar.com/avatar/' + SparkMD5.hash(this.email.toLowerCase()) + '?s=' + (size || 28) + '&d=retro';
    }
};

function User(displayName, email) {
    var obj = Object.create(proto);
    if (proto.isPrototypeOf(displayName)) {
        return displayName;
    } else if (!displayName || typeof displayName !== 'string') {
        throw new Error('Email address string is required at minimum to construct a user');
    } else  if (displayName && email) {
        obj.name = displayName.trim();
        obj.email = email.trim();
    } else if (displayName.indexOf('@') >= 0) {
        var parsed = tryParse(displayName);
        if (parsed) {
            obj.name = parsed.name;
            obj.email = parsed.email;
        } else {
            obj.name = '';
            obj.email = displayName.trim();
        }
    } else {
        throw new Error("Cannot parse as user: " + displayName)
    }
    return obj;
}

module.exports = User;
