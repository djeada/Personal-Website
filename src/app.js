function onMenuClick(e) {
    var dom = e.currentTarget;
    var elemRect = dom.getBoundingClientRect()
    var x = e.pageX - elemRect.left;
    var y = e.pageY - elemRect.top;
    var rippleDiv = document.createElement("div");
    var domTokenList = rippleDiv.classList;
    domTokenList.add("ripple");
    rippleDiv.setAttribute("style", "top:" + (String(y) + ("px; left:" + (String(x) + "px;"))));
    dom.appendChild(rippleDiv);
    setTimeout((function() {
      dom.removeChild(rippleDiv);
      return /* () */ 0;
    }), 900);
    return /* () */ 0;
  }