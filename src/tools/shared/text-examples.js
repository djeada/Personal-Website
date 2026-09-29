// Examples use the same actions as user-provided input.
document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('load-example');
    if (!button) return;
    button.addEventListener('click', () => {
        const original = document.getElementById('text1');
        if (original) {
            original.value = 'Hello world!\nThis is the original text.';
            document.getElementById('text2').value = 'Hello Berlin!\nThis is the revised text.';
            document.getElementById('compare').click();
        } else {
            const input = document.getElementById('input-text');
            input.value = location.pathname.includes('/strip_html/')
                ? '<h2>Hello Berlin!</h2><p>A <strong>simple</strong> HTML example.</p>'
                : 'Hello Berlin!\n\nA simple text example.\tWith extra spacing.';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('process').click();
        }
        document.getElementById('example-status').textContent = 'Example loaded and processed. Edit the input to try your own changes.';
    });
});
