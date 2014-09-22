var LoungeBots = function() {
    this.status = null;
};

LoungeBots.prototype.updateStatus = function(status) {
    if (!(this instanceof LoungeBots)) {
        throw new TypeError("'this' must be instance of LoungeBots");
    }

    this.status = status;
    if(status == 1) {
        $("#bot-status").addClass("online");
    }
    else {
        $("#bot-status").removeClass("online");
    }
};