/**
 * Customer Account Menu Item Extension
 */

shopify.extend('customer-account.menu-item.render', (root, { query }) => {
  query(`
    query {
      customer {
        tags
      }
    }
  `).then((result) => {
    const tags = result?.data?.customer?.tags || [];

    if (tags.includes('wholesale')) {
      // 's-link' acts as the menu item link
      const menuItem = root.createComponent('s-link', {
        to: '/pages/wholesale-portal',
      }, 'Wholesale Portal');

      root.appendChild(menuItem);
    }
  }).catch((error) => {
    console.error('Error fetching customer tags:', error);
  });
});
