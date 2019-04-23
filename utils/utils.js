
const getHighestOcurrence = (arr) => {
	const occurences = {}
	let max = 0

	arr.forEach(e => {
		if(occurences[e] == undefined){
			occurences[e]=1
		} else {
			 occurences[e] += 1
		}
		if(occurences[e] > max) {
			max = occurences[e]
		}
	});

	return max;
}

const groupBy = (arr, key)  => {
	return arr.reduce((result, e) => {
		result[e[key]] == undefined ? result[e[key]] = [e] : result[e[key]].push(e);
		return result
	}, {})
}

module.exports = {
	getHighestOcurrence,
	groupBy
}