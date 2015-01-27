"use strict";
$(document).ready(function(){
    var issuesId = "githubIssues";
    var issueCount = 5;
    var issues = "https://api.github.com/search/issues?q=repo:ncla/loungedestroyer&s=created";
    var htmlTemplate = '<div class="row"><h5><a href="REPLACE_URL" target="_blank">REPLACE_TITLE</a></h5></div>';

    function getHtmlForIssue(url, title){
        var res = htmlTemplate.replace("REPLACE_URL", url);
        res = res.replace("REPLACE_TITLE", title);
        return res;
    }

    function clearIssues(){
        $("#"+issuesId)[0].innerHTML = "";
    }

    function appendIssue(issueHtml){
        $("#"+issuesId).append(issueHtml);
    }

    function onError(){
        $("#"+issuesId)[0].innerHTML = "Failed to get issues and discussions.";
    }

    function isValid(data){
        return data !== undefined && data.items !== undefined;
    }

    $.ajax({
        url: issues,
        type: "get",
        success: function(data){
            if(!isValid(data)){
                onError();
                return;
            }else{
                clearIssues();
                for(var i=0; i < issueCount; i++){
                    if(data.items[i] && data.items[i].html_url && data.items[i].title) {
                        var html = getHtmlForIssue(data.items[i].html_url, data.items[i].title);
                        if(i !== issueCount-1){
                            html += '<hr>';
                        }
                        appendIssue(html);
                    }
                }
            }
        },
        error: onError
    });

});