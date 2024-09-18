document.addEventListener("DOMContentLoaded", function() {
    const inputText = document.getElementById("input-text");
    const outputText = document.getElementById("output-text");
    const convertButton = document.getElementById("convert");
    const clearButton = document.getElementById("clear");

    function markdownToHtml(markdown) {
        return markdown
            .replace(/(^|\s)\*(.*?)\*(\s|$)/g, '$1<strong>$2</strong>$3')
            .replace(/(^|\s)_(.*?)_(\s|$)/g, '$1<em>$2</em>$3')
            .replace(/(?:^|\n)### (.*?)$/gm, '<h3>$1</h3>')
            .replace(/(?:^|\n)## (.*?)$/gm, '<h2>$1</h2>')
            .replace(/(?:^|\n)# (.*?)$/gm, '<h1>$1</h1>')
            .replace(/(?:^|\n)#### (.*?)$/gm, '<h4>$1</h4>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
            .replace(/\n/g, '<br>');
    }

    convertButton.addEventListener("click", () => {
        const markdownText = inputText.value;
        const htmlText = markdownToHtml(markdownText);
        outputText.innerHTML = htmlText;
    });

    clearButton.addEventListener("click", () => {
        inputText.value = "";
        outputText.innerHTML = "";
    });

    inputText.addEventListener("input", () => {
        const markdownText = inputText.value;
        const htmlText = markdownToHtml(markdownText);
        outputText.innerHTML = htmlText;
    });
});
