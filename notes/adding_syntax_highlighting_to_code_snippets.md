
All of the Prism files are also accessible as a CDN, so you don't have to download anything if you don't want to:

```html
<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.5.0/themes/prism.min.css"
/>

<script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.5.0/prism.min.js"></script>
```


Wrap your desired code in `<pre><code class="language-whatever"> ... </pre>`:

```html
<pre><code class="language-css">body {
      font: 100% Helvetica, sans-serif;
      color: #333;
    }

    .box {
      -webkit-border-radius: 10px;
      -moz-border-radius: 10px;
      -ms-border-radius: 10px;
      border-radius: 10px;
    }

</pre>
```

For HTML you have to escape it: https://www.freeformatter.com/html-escape.html
