
const getHighestOcurrence = (arr) => {
	const occurences = {};
	let max = 0;

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
};

const groupBy = (arr, key)  => {
	return arr.reduce((result, e) => {
		result[e[key]] == undefined ? result[e[key]] = [e] : result[e[key]].push(e);
		return result
	}, {})
};

const logErr = (err) => { if (err) console.log(err) };


const blocktoJson = (block) => ({
	block_number: block.block_number.toFixed(),
	root_hash: block.root_hash,
	header_hash: block.header_hash,
	timestamp: block.timestamp,
	transactions: block.transactions
});

module.exports = {
	getHighestOcurrence,
	groupBy,
	logErr,
	blocktoJson
};