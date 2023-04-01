document.addEventListener("DOMContentLoaded", function() {
    const inputText = document.getElementById("input-text");
    const outputText = document.getElementById("output-text");
    const processButton = document.getElementById("process");
    const clearButton = document.getElementById("clear");

    processButton.addEventListener("click", () => {
        const rawText = inputText.value;
        const strippedText = rawText
            .replace(/[\u200B-\u200D\uFEFF]/g, "")
            .replace(/\u00A0/g, " ")
            .normalize("NFKD")
            .replace(/[\u0300-\u036F]/g, "");
        outputText.value = strippedText;
    });

    clearButton.addEventListener("click", () => {
        inputText.value = "";
        outputText.value = "";
    });
});