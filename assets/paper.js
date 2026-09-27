/* Locally bundled TeX rendering. No network is required to open this folder. */
(() => {
  'use strict';
  for (const element of document.querySelectorAll('.paper-math[data-tex]')) {
    try {
      katex.render(element.dataset.tex, element, {
        displayMode: element.dataset.display === 'true',
        macros: {'\\normlp':'\\mathrm{NormLP}', '\\tokenprobe':'\\mathrm{TokenProbe}'},
        throwOnError: true, strict: 'ignore', output: 'htmlAndMathml'
      });
      element.dataset.rendered = 'true';
    } catch (error) {
      element.classList.add('math-error');
      console.error('Could not render source equation:', element.dataset.tex, error.message);
    }
  }
})();
