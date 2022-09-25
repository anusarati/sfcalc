// this work is dedicated to the public domain and may be used under the 0 BSD license
// thanks to developer.mozilla.org and FOSS community and Humans Of Julia and Julia lang docs
// this doesn't work for precision of more than 16 decimal digits because of the limited precision of Number
// significant figures lose precision with many sequential calculations anyways
// e.g. add numbers with 1 significant figure between 1 and 9 a billion times, it could be anywhere from 1 billion to 9 billion, but all the digits would be significant with the conventional rules
// it's possible to maintain consistent error bounds programmatically with error propagation
// https://en.wikipedia.org/wiki/Propagation_of_uncertainty
// but significant figure rules are convention and are good enough for a few calculations, and error propagation is harder to do manually
class sfcalc {
	// returns index of first significant figure in string
	static firstSigIndex(s)
	{
		let fsi=s.search(/[^0.]/);
		if (fsi==-1) return s.length-1;
		return fsi;
	}
	// count number of sigfigs in string
	static nsigfig(s,fsi=sfcalc.firstSigIndex(s))
	{
		s=s.substring(fsi);
		//https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#advanced_searching_with_flags
		let ei=s.search(/e/i);
		if (ei!=-1) s=s.substring(0,ei); // remove scientific notation
		// assuming 0 and 0. and 0.00000000 have 1 significant figure
		let f=s.length;
		if (s.includes('.')) f--;// subtract 1 because one character is a dot
		else
		{
			let m=s.match(/0+$/);
			if (m) f-=m[0].length; // exclude insignificant trailing zeros
		}
		if (s.includes('-')) f--; // minus sign does not count as a significant figure
		// thanks to Geoffrey Hinton and Flux.jl and machine learning community
		return Math.max(1,f); // at least 1 significant figure

	}
	constructor(data,sf)
	{
		// https://stackoverflow.com/q/30689817 reminded me I could check the type dynamically
		// thanks to my CS teacher Shankar Kumar
		if (/^[sS]tring$/.test(typeof(data)))
		{
			// s should be convertible to a number via Number(s)
			let s=data;
			this.data=Number(s);
			this.sf=sfcalc.nsigfig(s);
		}
		else
		{
			this.data=data;
			this.sf=sf;
		}
	}
	// decimal, x of f*10^x
	get orderOfMagnitude()
	{
		return this.data ? Math.floor(Math.log10(Math.abs(this.data))) : 0; // 0 for 0
	}
	// power of 10 for most significant decimal place
	get mostSignificantDecimalPlace()
	{
		return this.orderOfMagnitude-this.sf+1;
	}
	// returns least significant of the most significant decimal places of two data
	greaterMostSignificantDecimalPlace(o)
	{
		// thanks to Geoffrey Hinton and Flux.jl and machine learning community
		return Math.max(this.mostSignificantDecimalPlace,o.mostSignificantDecimalPlace);
	}
	add(o)
	{
		let dp=this.greaterMostSignificantDecimalPlace(o);
		this.data+=o.data;
		this.sf=this.orderOfMagnitude-dp+1;
		return this;
	}
	subtract(o)
	{
		let dp=this.greaterMostSignificantDecimalPlace(o);
		this.data-=o.data;
		this.sf=this.orderOfMagnitude-dp+1;
		return this;
	}
	multiply(o)
	{
		this.data*=o.data;
		this.sf=Math.min(this.sf,o.sf);
		return this;
	}
	divide(o)
	{
		this.data/=o.data;
		this.sf=Math.min(this.sf,o.sf);
		return this;
	}
	copy()
	{
		return new sfcalc(this.data,this.sf);
	}
	sum(o)
	{
		return this.copy().add(o);
	}
	difference(o)
	{
		return this.copy().subtract(o);
	}
	product(o)
	{
		return this.copy().multiply(o);
	}
	division(o)
	{
		return this.copy().divide(o);
	}
	// rounds according to sigfig rules
	sfRound()
	{
		let n=this.data;
		let power=Math.pow(10,-this.mostSignificantDecimalPlace);
		n*=power;
		// https://en.wikipedia.org/wiki/Floor_and_ceiling_functions
		// thanks to my CS teacher Shankar Kumar
		let digitAfterMostSignificantDigit=Math.trunc(10*(n%1)); n=Math.trunc(n);
		let mostSignificant=n%10;
		if (digitAfterMostSignificantDigit>5 || (digitAfterMostSignificantDigit==5 && mostSignificant%2)) n++;
		return n/power;
	}
	// makes s have the same number of sf when read, assuming it doesn't have e notation
	fix(s){
		;
		// remove leading zeros before one before dot 
		s=s.substring(s.search(/[^0]|0?\./));
		// remove digits past most significant figure
		let fsi=sfcalc.firstSigIndex(s);
		if (fsi!=-1) s=s.substring(0,fsi+this.sf);
		let f=sfcalc.nsigfig(s,fsi);
		let frac=this.data%1;
		// add dot if needed
		if (this.sf>=f && !frac) s+='.'; // assuming that if frac the string would already have a dot
		// add significant zeros
		return s.padEnd(s.length+this.sf-sfcalc.nsigfig(s,fsi),'0');
	}
	// thanks to my CS teacher Shankar Kumar
	toString(pute=true)
	{
		let n=this.sfRound(), s=new String(n);
		if (!s.includes('e')) // it keeps the e if it's already there even if pute=false
		{
			s=this.sfRound().toString();
			s=this.fix(s);
			if (pute)
			{
				// thanks to regex101.com and MDN and regexone and whoever helped me learn regex and Hector Albizo
				s=s.substring(sfcalc.firstSigIndex(s)).replace(/([1-9])/,"$1."); // start from the first significant figure and add a dot if it's not just 0

				let oom=this.orderOfMagnitude;
				s+='e';
				if (oom>=0) s+='+'; // mimic C++ and JS
				s+=oom;
			}
		}
		return s;
	}
	// interprets an expression with ()+-*/ log10 and antilog10
	// does not interpret x as *
	// thanks to Python documentation
	static interpret(s)
	{
		let node,nodes;
		function descend() { node=new SyntaxNode; nodes.push(node); }
		function ascend() { node=nodes[nodes.length-2].evaluate(nodes.pop().arg); }
		//https://en.wikipedia.org/wiki/Parsing#Parser
		class SyntaxNode
		{
			op; arg;
			evaluate(n)
			{
				//console.log('evaluate ','n ',n,' paren ',paren,' op ',this.op,' arg ',this.arg);
				switch (this.op)
				{
					case '+':
						this.arg.add(n); break;
					case '-':
						this.arg.subtract(n); break;
					case '*':
						this.arg.multiply(n); break;
					case '/':
						this.arg.divide(n); break;
					case 'log10':
						this.arg=n.log10(); break;
					case 'antilog10':
						this.arg=n.antilog10(); break;
					default:
						if (this.arg)
						{
							if (this.op=='(') this.arg.multiply(n); // e.g. 2(3)==6
							// interpret an adjacent negative number as subtraction
							// e.g. 2-3=-1
							else this.arg.add(n); 
						}
						else this.arg=n;
				}
				this.op=undefined;
				return this;
			}
			pass(oper)
			{
				switch(this.op)
				{
					case '+': case '-':
						switch (oper)
						{
							case '+': case '-':
								if (nodes.length>1)
								{	
									ascend();
									if (this.op!=oper) node.pass('-'); // +- or -+
									else node.pass('+'); // ++ or --
								} else this.op=oper;
								break;
							default: descend(); node.op=oper; break;
						}
						break;
					case '*': case '/': this.op=oper; break;
					default:
						if (oper!='antilog10' && oper!='log10') this.op=oper; // if oper is a 2 argument operation
						else
						{
							if (!this.op) this.op='('; // interpret xlog10 y as x*log10 y
							descend();
							node.op=oper;
						}
						break;
				}
			}
		}
		// https://regex101.com/
		let nregex=/(?<!log\d*)-?(\d+\.?\d*|\.\d+)(([eE])-?\d+)?/g, antilogreg=/antilog10/g, logreg=/log10/g;
		node=new SyntaxNode; nodes=[node];
		let m=nregex.exec(s), mantil=antilogreg.exec(s), mlog=logreg.exec(s);
		for (let i=0;i<s.length;i++)
		{
			//console.log(s[i]);
			//console.log(nodes);
			if (m && i==m.index)
			{
				let n=new sfcalc(m[0]);
				if (node.op!='+' && node.op!='-') node.evaluate(n);
				else { descend(); node.arg=n; } 
				i+=m[0].length-1;
				m=nregex.exec(s);
			}
			else
			{
				let c=s[i];
				switch (c)
				{
					// thanks to Aaron R. Matthis for reminding me about parentheses nesting
					case '(':
						if (!node.op) node.op='(';
						descend();
						break;
					case ')':
						ascend();
						break;
					case 'a':
						if (mantil && i==mantil.index)
						{
							node.pass("antilog10");
							mantil=antilogreg.exec(s);
							i+=8;
						}
						break;
					case 'l':
						if (mlog && i==mlog.index)
						{
							node.pass("log10");
							mlog=logreg.exec(s);
							i+=4;
						}
						break;
					default:
					 	if ("+-/*".includes(c)) node.pass(c);
						break;
				}
			}
			//console.log(nodes);
		}
		while (nodes.length>1) ascend();
			//console.log(nodes);
		return node.arg;
	}
	log10()
	{
		let n=new sfcalc;
		n.data=Math.log10(this.data);
		n.sf=this.sf;
		if (Math.trunc(this.data)) n.sf++;
		return n;
	}
	antilog10()
	{
		let n=new sfcalc;
		n.sf=this.sf;
		if (Math.trunc(this.data)) n.sf--;
		n.data=Math.pow(10,this.data);
		return n;
	}
	sqrt()
	{
		let n=new sfcalc;
		n.sf=this.sf; n.data=Math.sqrt(this.data);
		return n;
	}
	// same with sfRound
	equivalent(x)
	{
		if (x instanceof sfcalc)
			return this.sf==x.sf && this.sfRound()==x.sfRound();
		else if (/^[sS]tring$/.test(typeof(x))) return this.equivalent(new sfcalc(x)); // if x is a string
		else return this.equivalent(new sfcalc(String(x)));
	}
	// logs whether generated calculation is equivalent to right hand side
	static unitTest(name,generated,right)
	{
		console.log(name+" test");
		console.log("Expected "+right);
		console.log("Got "+generated.toString());
		console.log(generated.equivalent(right),new sfcalc(generated.toString()).equivalent(right)); // supposed to check numeric and string representation
	}
}
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export
// web
//export default sfcalc;
// Node.js
if (module && module.exports) module.exports=sfcalc;


