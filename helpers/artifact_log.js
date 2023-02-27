const low  = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const getDb = () => low(new FileSync('./deployed-contracts.json'));

async function writeAddr(addr, name, network, deployer){

    await getDb()
        .set(`${name}.${network}`, {
            address: addr,
            deployer: deployer,
        })
        .write();
}

async function getAddr(name, network){
    let addr
    try {
        addr = (await getDb().get(`${name}.${network}`).value()).address
    } catch (e) {
        addr = ""
    }
    return addr;
}

module.exports = {
    getAddr,
    writeAddr
}