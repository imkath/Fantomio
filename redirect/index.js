/* global URL, Response */
// Sends the old address (ghostswap.nvrkth.com) and www.fantomio.com to https://fantomio.com
// with a permanent redirect, keeping the path and the query: invitation links, group links and
// email links sent before the rename keep working, and search engines move the old results to
// the new domain.
const TARGET = 'https://fantomio.com'

export default {
  fetch(request) {
    const url = new URL(request.url)
    return Response.redirect(TARGET + url.pathname + url.search, 301)
  },
}
