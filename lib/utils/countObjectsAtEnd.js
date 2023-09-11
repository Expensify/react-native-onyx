export default function countObjectsAtEndOfArray(array) {
    let count = 0;
    for (let i = array.length - 1; i >= 0; i--) {
        if (typeof array[i] === 'object' && array[i] !== null) {
            count++;
        } else {
            break;
        }
    }
    return count;
}
