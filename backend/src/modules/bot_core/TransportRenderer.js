class TransportRenderer {
  renderView(view) {
    return {
      text: [view.title, view.text].filter(Boolean).join('\n\n'),
      actions: Array.isArray(view.actions) ? view.actions : [],
    };
  }
}

module.exports = { TransportRenderer };
