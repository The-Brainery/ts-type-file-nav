export class db {
    constructor(){
        console.log("MainClass constructor")
    }
    user?: {
        name: string;
        age: number;
        getName: () => string;
        hooks : {}
    }
}
