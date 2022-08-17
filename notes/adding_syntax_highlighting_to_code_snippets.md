
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
<pre><code class="language-css">
selector {
     property_a: some_value;
     property_b: other_value;
}
</pre>
```

For HTML you have to escape it: https://www.freeformatter.com/html-escape.html
