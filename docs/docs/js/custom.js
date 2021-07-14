// Terminal CSS
// Modify the text to encapsulate ($,>,>>>) within one span tags
// So its not selectable

// Iterate all the items with class: `highlight`
var highlight_divs = document.getElementsByClassName("highlight")

for(var i = 0; i < highlight_divs.length; i++) {
    var highlight = highlight_divs[i];
    var pre_block = highlight.getElementsByTagName("code")[0];


    // Valid regexes that will be replace
    var terminal_regex = "^(<span></span>)?(\")?\\$ ";
    var console_regex = '^(<span></span>)?<span class="gp">\\$</span> ';
    var r_console_regex = '^(<span></span>)?<span class="o">&gt;</span> ';
    var python_shell_regex = '^(<span></span>)?<span class="o">&gt;&gt;&gt;</span> ';
    regexs = [terminal_regex, console_regex, r_console_regex, python_shell_regex]

    // Replacements for each of the regex
    replacements = ["$", "$", "&gt;", "&gt;&gt;&gt;"]

    for (j in regexs) {
        var regex = regexs[j]
        var replacement = replacements[j]
        var re = new RegExp(regex, "gm");
        var str = pre_block.innerHTML;
        str = str.replace(re, "<span class=\"code-noselect\">" + replacement + " </span>");
        pre_block.innerHTML = str;

    }
}