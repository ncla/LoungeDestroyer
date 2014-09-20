var LoungeBots = function() {
    this.status = null;
    this.updateStatus = function(status) {
        this.status = status;
        if(status == 1) {
            $("#bot-status").addClass("online");
        }
        else {
            $("#bot-status").removeClass("online");
        }
    }
};