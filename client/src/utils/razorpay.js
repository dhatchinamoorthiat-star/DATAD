/**
 * Loads Razorpay Checkout on demand.
 *
 * Kept out of index.html deliberately: the script is ~100kB and only a handful
 * of sessions ever reach checkout, so every other page load would pay for it.
 * The promise is cached, so opening checkout twice loads the script once.
 */
const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

let loader = null;

export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      // Cleared so a failure caused by a dropped connection or a campus network
      // blocking the CDN can be retried, rather than poisoning every later
      // attempt for the life of the tab.
      loader = null;
      reject(new Error('Could not load the payment window. Check your connection and try again.'));
    };
    document.body.appendChild(script);
  });

  return loader;
}
