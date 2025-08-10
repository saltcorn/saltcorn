const dumpHTML = async (page) => {
  const iframeHandle = await page.locator("iframe").elementHandle();
  if (iframeHandle) {
    const contentFrame = await iframeHandle.contentFrame();
    if (contentFrame) {
      const html = await contentFrame.content();
      console.log("Iframe HTML content:\n", html);
    } else console.error("Could not get iframe contentFrame.");
  } else console.error("Could not get iframe element handle.");
};

module.exports = {
  dumpHTML,
};
