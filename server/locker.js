module.exports = Locker;

var log = new (require('./logging'))('./logs');

function Locker() {
    this.lockedTasks = {};

    function test() {
        console.log('foo called');
        console.log('this.lockedTasks.length', this.lockedTasks.length);
    }
}

function initItinerary(lockedTasks, itineraryId) {
    if (lockedTasks[itineraryId]) return;

    lockedTasks[itineraryId] = {
        lastChange: 0,
        locked: []
    };
}

Locker.prototype.lockTask = function (itineraryId, taskId, user) {
    initItinerary(this.lockedTasks, itineraryId);

    if (this.checkTaskLock(itineraryId, taskId, user)) return;

    var timestamp = Date.now();
    this.lockedTasks[itineraryId].locked.push({
        taskId: taskId,
        user: user,
        timestamp: timestamp
    });

    this.lockedTasks[itineraryId].lastChange = timestamp;
};

Locker.prototype.unlockTask = function (itineraryId, taskId, user) {
    if (!this.lockedTasks[itineraryId]) return false;

    for (var i = 0; i < this.lockedTasks[itineraryId].locked.length; i++) {
        if (this.lockedTasks[itineraryId].locked[i].taskId == taskId
            && this.lockedTasks[itineraryId].locked[i].user == user) {
            this.lockedTasks[itineraryId].locked.splice(i, 1);
            this.lockedTasks[itineraryId].lastChange = Date.now();
            return true;
        }
    }

    return false;
};

Locker.prototype.checkLocks = function (itineraryId, lastCheckTime) {
    if (!this.lockedTasks[itineraryId] ||
        this.lockedTasks[itineraryId].lastChange <= lastCheckTime) return false;

    return this.lockedTasks[itineraryId];
};

Locker.prototype.checkTaskLock = function (itineraryId, taskId, user, notLockedCallback, lockedCallback) {
    if (!this.lockedTasks[itineraryId]) {
        if (notLockedCallback) notLockedCallback();
        return false;
    }

    for (var i = 0; i < this.lockedTasks[itineraryId].locked.length; i++) {
        if (this.lockedTasks[itineraryId].locked[i].taskId == taskId) {
            if (lockedCallback) lockedCallback(this.lockedTasks[itineraryId].locked[i].user);
            return true;
        }
    }

    if (notLockedCallback) notLockedCallback();
};

Locker.prototype.getBlockerName = function (itineraryId, taskId) {
    if (!this.lockedTasks[itineraryId]) return;

    for (var i = 0; i < this.lockedTasks[itineraryId].locked.length; i++) {
        if (this.lockedTasks[itineraryId].locked[i].taskId == taskId) {
            return this.lockedTasks[itineraryId].locked[i].user;
        }
    }

    return '';
};

Locker.prototype.checkRouteLocks = function (itineraryId, taskIdArr, user, notLockedCallback, lockedCallback) {
    var blockerName;

    for (var i = 0; i < taskIdArr.length; i++) {
        if (this.checkTaskLock(itineraryId, taskIdArr[i], user)) {
            blockerName = this.getBlockerName(itineraryId, taskIdArr[i]);
            //console.log('blockerName', blockerName);
            if (blockerName !== user) {
                if (lockedCallback) lockedCallback(blockerName);
                return true;
            }
        }
    }

    notLockedCallback();
    return false;
};

Locker.prototype.lockRoute = function (itineraryId, routeId, taskIdArr, user) {
    console.log('routeId', routeId);
    for (var i = 0; i < taskIdArr.length; i++) {
        this.lockTask(itineraryId, taskIdArr[i], user);
    }
};

Locker.prototype.unlockRoute = function (itineraryId, taskIdArr, user) {
    var result = {
        'unlocked': 0,
        'not_yours': 0
    };
    for (var i = 0; i < taskIdArr.length; i++) {
        if (this.unlockTask(itineraryId, taskIdArr[i], user)) result.unlocked++;
        else result.not_yours++;
    }

    return result;
};









