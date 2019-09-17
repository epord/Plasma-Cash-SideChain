import BN = require("bn.js");
import utils = require("web3-utils");

/**
 *
 */
export class SparseMerkleTree {

    private depth: number;
    private leaves: Map<string, string>;
    private tree: Array<Map<string, string>>;
    public root: string;


    constructor(depth: number, leaves: Map<string, string>) {
        // Leaves must be a dictionary with key as the leaf's slot and value the leaf's hash
        this.leaves = leaves;
        this.depth = depth;
        // Initialize defaults
        let defaultNodes: Array<string> = this.buildDefaultNodes(depth);

        if (this.leaves && this.leaves.size !== 0) {
            this.tree = this.createTree(this.leaves, this.depth, defaultNodes);
            this.root = this.tree[this.depth].get('0')!;
        } else {
            this.tree = new Array<Map<string, string>>();
            this.root = defaultNodes[this.depth];
        }
    }

    private buildDefaultNodes(depth: number): Array<string> {
        let defaultNodes = new Array<string>(depth + 1);
        defaultNodes[0] = utils.soliditySha3(0);
        for (let i = 1; i < depth + 1; i++) {
            defaultNodes[i] = utils.soliditySha3(defaultNodes[i-1], defaultNodes[i-1]);
        }
        return defaultNodes;
    }

    private createTree(leaves: Map<string, string>, depth: number, defaultNodes: Array<string>) {
        let tree: Array<Map<string, string>> = [leaves];
        let treeLevel: Map<string, string> = leaves;

        let nextLevel: Map<string, string>;
        let halfIndex: string;

        for (let level = 0; level < depth; level++) {
            nextLevel = new Map();
            for(let [slot, hash] of treeLevel) {
                halfIndex = new BN(slot).div(new BN(2)).toString();
                if (new BN(slot).mod(new BN(2)).isZero()) {
                    let coIndex: string = new BN(slot).add(new BN(1)).toString();
                    nextLevel.set(halfIndex, utils.soliditySha3(hash, treeLevel.get(coIndex) || defaultNodes[level]));
                } else {
                    let coIndex: string = new BN(slot).sub(new BN(1)).toString();
                    if (treeLevel.get(coIndex) === undefined) {
                        nextLevel.set(halfIndex, utils.soliditySha3(defaultNodes[level], hash));
                    }
                }
            }
            treeLevel = nextLevel;
            tree.push(treeLevel);
        }
        return tree;
    }

    createMerkleProof(slot: string) {
        let index: BN = new BN(slot);
        let proof: string = '';
        let proofBits: BN = new BN(0);
        let siblingIndex: BN;
        let siblingHash: string | undefined;
        for (let level=0; level < this.depth; level++) {
            siblingIndex = index.mod(new BN(2)).isZero() ? index.add(new BN(1)) : index.sub(new BN(1));
            index = index.div(new BN(2));

            siblingHash = this.tree[level] ? this.tree[level].get(siblingIndex.toString()) : undefined;
            if (siblingHash) {
                proof += siblingHash.replace('0x', '');
                proofBits = proofBits.bincn(level);
            }
        }

        let buf = proofBits.toBuffer('be', 8);
        let total = Buffer.concat([buf, Buffer.from(proof, 'hex')]);
        return '0x' + total.toString('hex');
    }
}