"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INDIAN_NAMES_POOL = void 0;
exports.getRandomCustomerName = getRandomCustomerName;
exports.getShuffledCustomerNames = getShuffledCustomerNames;
/**
 * Diverse Indian Names Pool for Natural Transaction Generation
 */
exports.INDIAN_NAMES_POOL = [
    'Aarav Sharma',
    'Ananya Iyer',
    'Vikram Patel',
    'Neha Gupta',
    'Rohan Joshi',
    'Priya Nair',
    'Kabir Mehta',
    'Pooja Deshmukh',
    'Rahul Verma',
    'Sneha Reddy',
    'Arjun Nair',
    'Kavita Rao',
    'Amit Deshmukh',
    'Diya Sen',
    'Manish Kumar',
];
function getRandomCustomerName(exclude = []) {
    const available = exports.INDIAN_NAMES_POOL.filter((name) => !exclude.includes(name));
    const pool = available.length > 0 ? available : exports.INDIAN_NAMES_POOL;
    return pool[Math.floor(Math.random() * pool.length)];
}
function getShuffledCustomerNames(count) {
    const shuffled = [...exports.INDIAN_NAMES_POOL].sort(() => 0.5 - Math.random());
    const result = [];
    while (result.length < count) {
        for (const name of shuffled) {
            if (result.length < count) {
                result.push(name);
            }
        }
    }
    return result;
}
