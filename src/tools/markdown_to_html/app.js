document.addEventListener("DOMContentLoaded", function () {
  const inputText = document.getElementById("input-text");
  const outputText = document.getElementById("output-text");
  const convertButton = document.getElementById("convert");
  const clearButton = document.getElementById("clear");

  convertButton.addEventListener("click", () => {
    const markdownText = inputText.value;
    const htmlText = marked(markdownText);
    outputText.value = htmlText;
  });

  clearButton.addEventListener("click", () => {
    inputText.value = "";
    outputText.value = "";
  });
});
