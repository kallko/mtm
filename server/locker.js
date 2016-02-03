module.exports = Locker;

var log = new (require('./logging'))('./logs');

// класс для блокировки/разблокировки отдельных точек и маршрутов целиком
function Locker() {
    // список заблокирвоанных решений
    this.lockedTasks = {};

    function test() {
        console.log('foo called');
        console.log('this.lockedTasks.length', this.lockedTasks.length);
    }
}

// начальная инциализация указанного решения в списке заблокированных задач
function initItinerary(lockedTasks, itineraryId) {
    if (lockedTasks[itineraryId]) return;

    lockedTasks[itineraryId] = {
        lastChange: 0,
        locked: []
    };
}

// блокировка задачи
Locker.prototype.lockTask = function (itineraryId, taskId, user, routeId) {
    initItinerary(this.lockedTasks, itineraryId);

    if (this.checkTaskLock(itineraryId, taskId, user)) return;

    var timestamp = Date.now();
    this.lockedTasks[itineraryId].locked.push({
        taskId: taskId,
        user: user,
        timestamp: timestamp,
        routeId: routeId
    });

    this.lockedTasks[itineraryId].lastChange = timestamp;
};

// разблокировка задачи
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

// получение забокированных задач по указанному id решения
Locker.prototype.checkLocks = function (itineraryId, lastCheckTime) {
    if (!this.lockedTasks[itineraryId] ||
        this.lockedTasks[itineraryId].lastChange <= lastCheckTime) return false;

    return this.lockedTasks[itineraryId];
};

// проверка блокировки задачи и в случае наличия таковой возвращения имени блокирующего пользователя
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

// получить имя пользователся заблокировашего задачу
Locker.prototype.getBlockerName = function (itineraryId, taskId) {
    if (!this.lockedTasks[itineraryId]) return;

    for (var i = 0; i < this.lockedTasks[itineraryId].locked.length; i++) {
        if (this.lockedTasks[itineraryId].locked[i].taskId == taskId) {
            return this.lockedTasks[itineraryId].locked[i].user;
        }
    }

    return '';
};

// проверить блокировку маршрута и в случае наличия блокировки получить имя блокируещего пользователя
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

// заблокировать весь маршрут
Locker.prototype.lockRoute = function (itineraryId, routeId, taskIdArr, user) {
    this.unlockAllByUser(itineraryId, user);

    for (var i = 0; i < taskIdArr.length; i++) {
        this.lockTask(itineraryId, taskIdArr[i], user, routeId);
    }
};

// разблокировать весь маршрут
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

// разблокировать все задачи ранее заблокированные указанным пользователем
Locker.prototype.unlockAllByUser = function (itineraryId, user) {
    if (!this.lockedTasks[itineraryId]) return;

    for (var i = 0; i < this.lockedTasks[itineraryId].locked.length; i++) {
        if (this.lockedTasks[itineraryId].locked[i].user == user) {
            this.unlockTask(itineraryId, this.lockedTasks[itineraryId].locked[i].taskId, user);
            i--;
        }
    }
};