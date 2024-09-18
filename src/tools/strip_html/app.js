document.addEventListener("DOMContentLoaded", function() {
    const inputText = document.getElementById("input-text");
    const outputText = document.getElementById("output-text");
    const processButton = document.getElementById("process");
    const clearButton = document.getElementById("clear");
    const copyButton = document.getElementById("copy");
    const downloadButton = document.getElementById("download");

    function stripHTML(input) {
        const doc = new DOMParser().parseFromString(input, 'text/html');
        return doc.body.textContent || "";
    }

    processButton.addEventListener("click", () => {
        const rawText = inputText.value;
        const strippedText = stripHTML(rawText);
        outputText.value = strippedText;
    });

    clearButton.addEventListener("click", () => {
        inputText.value = "";
        outputText.value = "";
    });

    copyButton.addEventListener("click", () => {
        navigator.clipboard.writeText(outputText.value).then(() => {
            alert("Output copied to clipboard");
        }).catch(() => {
            alert("Failed to copy output");
        });
    });

    downloadButton.addEventListener("click", () => {
        const blob = new Blob([outputText.value], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "stripped_text.txt";
        link.click();
    });

    inputText.addEventListener("input", () => {
        if (!inputText.value.trim()) {
            outputText.value = "";
        }
    });

    inputText.addEventListener("paste", (event) => {
        setTimeout(() => {
            const strippedText = stripHTML(inputText.value);
            inputText.value = strippedText;
        }, 100);
    });
});
