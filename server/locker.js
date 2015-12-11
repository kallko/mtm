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

Locker.prototype.unlock = function (itineraryId, taskId, user) {
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
















