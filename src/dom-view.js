// Avoid reparsing/replacing unchanged DOM, including when a widget is hidden.
export function setText(element, text) {
  if (element.textContent !== text) element.textContent = text;
}
export function setMarkup(element, markup) {
  if (element.__markup !== markup) {
    const template = document.createElement('template');
    template.innerHTML = markup;
    patchChildren(element, template.content);
    element.__markup = markup;
  }
}
function patchChildren(live, next) {
  const oldChildren = [...live.childNodes],
    newChildren = [...next.childNodes];
  if (oldChildren.length !== newChildren.length) {
    live.replaceChildren(...newChildren);
    return;
  }
  for (let i = 0; i < oldChildren.length; i++) {
    const old = oldChildren[i],
      fresh = newChildren[i];
    if (old.nodeType !== fresh.nodeType || old.nodeName !== fresh.nodeName) {
      old.replaceWith(fresh);
    } else if (old.nodeType !== 1) {
      if (old.nodeValue !== fresh.nodeValue) old.nodeValue = fresh.nodeValue;
    } else {
      for (const attribute of [...old.attributes])
        if (!fresh.hasAttribute(attribute.name)) old.removeAttribute(attribute.name);
      for (const attribute of fresh.attributes)
        if (old.getAttribute(attribute.name) !== attribute.value)
          old.setAttributeNS(attribute.namespaceURI, attribute.name, attribute.value);
      patchChildren(old, fresh);
    }
  }
}
