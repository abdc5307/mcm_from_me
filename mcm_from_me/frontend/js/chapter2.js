const productName = document.getElementById("productName");
const productImage = document.getElementById("productImage");
const productStoryTitle = document.getElementById("productStoryTitle");
const productStoryDescription = document.getElementById("productStoryDescription");

try {
  const product = JSON.parse(sessionStorage.getItem("journeyProduct"));

  if (product?.name) productName.textContent = `${product.name}.`;
  if (product?.story_title) {
    const dot = productStoryTitle.querySelector(".gold-dot");
    productStoryTitle.replaceChildren(dot, document.createTextNode(product.story_title));
  }
  if (product?.story_desc) productStoryDescription.textContent = product.story_desc;
  if (product?.image_url) productImage.src = product.image_url;
} catch (error) {
  console.error("Stored product data is invalid", error);
}

productImage.addEventListener("error", () => {
  const fallbackSrc = productImage.dataset.fallbackSrc;
  if (fallbackSrc && productImage.src !== new URL(fallbackSrc, window.location.origin).href) {
    productImage.src = fallbackSrc;
  }
});
