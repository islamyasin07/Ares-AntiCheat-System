const bloomFilter = require('../../shared/bloomFilter');

/**
 * Add an item to the Bloom filter
 * @param {string} item - The item to add
 */
function addItem(item) {
  bloomFilter.add(item);
}

/**
 * Check if an item might exist in the Bloom filter
 * @param {string} item - The item to check
 * @returns {boolean} - True if the item might exist, false otherwise
 */
function mightExist(item) {
  return bloomFilter.has(item);
}

module.exports = { addItem, mightExist };