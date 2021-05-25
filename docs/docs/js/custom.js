// Terminal CSS
// Iterate all the items with class: `language-terminal`
var codehilites = document.getElementsByClassName("codehilite")
for(var i = 0; i < codehilites.length; i++) {
    var codehilite = codehilites[i];
    var pre_block = codehilite.getElementsByTagName("pre")[0];

    // Modify the text to encapsulate ($,>,>>>) within span tags
    var terminal_regex = "^(<span></span>)?\\$ ";
    var r_console_regex = '^(<span></span>)?<span class="o">&gt;</span> ';
    var python_shell_regex = '^(<span></span>)?<span class="o">&gt;&gt;&gt;</span> ';
    regexs = [terminal_regex, r_console_regex, python_shell_regex]
    replacements = ["$", "&gt;", "&gt;&gt;&gt;"]
    for (j in regexs) {
        var regex = regexs[j]
        var replacement = replacements[j]
        var re = new RegExp(regex, "gm");
        var str = pre_block.innerHTML;
        str = str.replace(re, "<span class=\"code-noselect\">" + replacement + " </span>");
        pre_block.innerHTML = str;
    }
}
