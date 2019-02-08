const path = require('path');
const multihashes = require('multihashes')
const rfc4648 = require('rfc4648')
const varint = require('varint')

const { Encoder, Decoder } = require('@holochain/n-bch-rs')

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
}
function randomHex(n) {
    let s = ''
    for ( let i = 0; i < n; ++i )
	s += getRandomInt(0,255).toString(16).padStart(2, '0')
    if ( s.length != n * 2 )
	maybelog("Invalid " + n + "-octet random hex produced: " + s)
    return s
}

function maybelog (...args) {
  // console.log(...args)
}

// Test Agent IDs.  Should be a valid multihashes value
//function main () {
    // 
    // The Base32 encoded Agent ID will always be comprised of a 40-bit, 5-octet (8 x Base32 symbol)
    // prefix containing 4 octets of prefix and 1 octet of length.  This 5-byte prefix can be
    // dropped after identifying the payload size.
    //
    // The length of the payload for a 256-bit key must always fit within 62 Base32 symbols, in
    // order to fit within the DNS label limit of 63 characters.  Thus, 63*5/8 == 39.374 == 35
    // octets == 56 symbols max w/o padding.
    // 
    // That yields 35 octets per 32-octet key, so it can carry 3 octets (24 bits) of Reed-Solomon
    // parity.  These 24 bits of parity data will be distributed into the 256 bits of key data;
    // every 10th bit will be pushed to the right and replaced by a parity bit, inflating the
    // payload data out to 256+24 == 280 bits == 56 Base32 symbols.  This distributes the entropy
    // throughout the key data; if 1 octet of key input changes, many output Base32 symbols change
    // (every 2nd one, approximately). When extracted, they are used as Reed-Solomon parity in an
    // RS(255,252) encoding w/ 3 octets parity and 32 octets of payload, hence 220 octets of
    // padding.  This can correct 1 octet of error or 2 erasures (TODO: denoted by including _ in
    // the input Base32 value, to mark the affected octet(s) as an erasure)
    // 
    // We use the capitalization of the available ~2/3 letter symbols (56*22/32 == 38.5) to encode
    // another 32 bits (4 octets) of R-S parity data.  If there is insufficient letters to carry all
    // 32 bits, then the missing symbols will be marked as erasurses. Or, if the capitalization
    // returns all zero or all 1 bits, then these 4 octets of parity will be marked as erasures for
    // the Reed-Solomon decoding.  These will employed in an RS(255,251) codec w/ 4 bytes parity
    // over 35 octets of payload.  For simplicity, we will run the R-S correction with each
    // successive parity octet from the last (4th) to the first marked as an erasure, until we get
    // the best decode; this is defined as one that A) identifies all data marked as erasures, and B) corrects the fewest 
    // 
    // So, 5 octets of R-S parity will be available (up to 2 marked as erasures), to provide
    // correction or confirmation of the 32-octets of key data.  An RS(255,250) codec will be used,
    // with 218 bytes of zero padding on the front.  The R-S decode must pass, and produce a result:
    // 
    // - Correcting each erasure
    // - Identifying *no* error positions within the padding
    //

    // Crockford Base 32: 10/32 digits, 22/32 (69%) letters.  In random data (ie. keys, hashes) we
    // should safely almost always see 1/2 letters.  So, for 32 symbols, we can encode 16 bits of
    // parity.  For the holofuel Base-32, we have 25/32 (78%) letters.  For 56-symbol Base-32, we
    // have almost 11 letters in every quarter of the 56-symbol key, 15 letters in each third!  This
    // virtually guarantees us the ability to fit 3 octets of Reed-Solomon encoding in the
    // capitalization data.
    let base32_crockford = {
	chars: '0123456789ABCDEFGHJKMNPQRSTVWXYZ', // Crockford; 0oO -> 0, 1iILl -> 1
	bits: 5,
    } 
    let base32_holochain = {
	chars: 'ABCDEFGHIJKMNOPQRSTUVWXYZ3456789', // 0->O, 1->I, lL->iI, 2->Z
	bits: 5,
    } 
    
    // Under Holochain Base-32, we pack a Public Key, a CAS Address hash, or a Signature into 39
    // octets, using 63 Base-32 symbols.  For 5-bit Base-32 encoding, clusters of 8 symbols encode 5
    // octets, so the natural unpadded Base-32 encoding for 40 octets is 64 symbols is:
    // 
    //    40 * 8 / 5 == 64 Base-32 symbols.
    // 
    // We want to encode a 3-octet prefix+size, 32-octet key/hash/sig, and 4 octets of Reed-Solomon
    // parity data == 39 octets.  63 Base-32 symbols will accomplish this, with 1 symbol of '='
    // padding emitted, which we will discard.  The result will exactly fit the 63-character limit
    // of a DNS label.
    // 
    // The first 5 Base-32 symbols encode a 2-octet prefix + a 1-octet size, leaving us with 36
    // octets (0x24) payload.  The first 3 Base-32 symbols are defined as 'Hc{K,A,S}'.  The 4th
    // symbol encode 1 bit of version plus the 4 bits of size 0x24, so will be 'C' in version == 0,
    // 'T' in version == 1.  The 5th symbol encodes 4 bits of size + 1 bit of payload, so will toggle
    // between 'I' and 'J', depending on the payload:
    // 
    //                         -S=17
    //                         -A=0  _T=18-J=9-
    //                H=7-_c=2_-K=10-_C=2_-I=8-_____-----_____
    //                0000011111222223333344444555556666677777 -- 8 Base-32 Symbols
    //                -----_____-----_____-----_____-----_____
    //                001110001001010000100100????????????????
    //                                --0x24-- == 36
    //                --------________--------________--------
    //                0000000011111111222222223333333344444444 -- 5 Octets
    //                ^^^^^^^^^^^^^^^ ^^^^^^^^
    //                 |             ^ |      ^^^^^^^^^^^^^^^^ ...
    //                 |             | |       |
    //                 |     version-+ |       +- payload
    //                 +- prefix       +- size
    // 
    // So, the 6 prefixes (3 types + 2 versions) for 256-bit keys/hashes/sigs, are:
    //
    //                         -S=17
    //                         -A=0  _T=18-J=9-
    //                H=7-_c=2_-K=10-_C=2_-I=8-
    //                -----_____-----_____-----
    //                                -------- = 0x24
    let HcK_v0_bin = '001110001001010000100100' // HcKc...
    let HcK_v1_bin = '001110001001010100100100' // HcKt...
    let HcA_v0_bin = '001110001000000000100100' // HcAc...
    let HcA_v1_bin = '001110001000000100100100' // HcAt...
    let HcS_v0_bin = '001110001010001000100100' // HcSc...
    let HcS_v1_bin = '001110001010001100100100' // HcSt...

    // Compute the prefixes for each Hc{K,A,S} type
    let HcK_v0_hex = bin_to_hex( HcK_v0_bin )
    let HcK_v1_hex = bin_to_hex( HcK_v1_bin )
    let HcA_v0_hex = bin_to_hex( HcA_v0_bin )
    let HcA_v1_hex = bin_to_hex( HcA_v1_bin )
    let HcS_v0_hex = bin_to_hex( HcS_v0_bin )
    let HcS_v1_hex = bin_to_hex( HcS_v1_bin )

    maybelog( "HcK v0 hex:     0x" + HcK_v0_hex )
    maybelog( "HcK v1 hex:     0x" + HcK_v1_hex )
    maybelog( "HcA v0 hex:     0x" + HcA_v0_hex )
    maybelog( "HcA v1 hex:     0x" + HcA_v1_hex )
    maybelog( "HcS v0 hex:     0x" + HcS_v0_hex )
    maybelog( "HcS v1 hex:     0x" + HcS_v1_hex )

    // Find the 'varint' encoding of each prefix + size
    function varint_bin_into_hex( bin ) {
	return Buffer.from( varint.encode( parseInt( bin, 2 ))).toString('hex')
    }

    let HcK_v0_pre_varints =
	varint_bin_into_hex( HcK_v0_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcK_v0_bin.slice(    16 ))
    maybelog( "HcK v0 varints: 0x" + HcK_v0_pre_varints )
    let HcK_v1_pre_varints =
	varint_bin_into_hex( HcK_v1_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcK_v1_bin.slice(    16 ))
    maybelog( "HcK v1 varints: 0x" + HcK_v1_pre_varints )
    let HcA_v0_pre_varints =
	varint_bin_into_hex( HcA_v0_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcA_v0_bin.slice(    16 ))
    maybelog( "HcA v0 varints: 0x" + HcA_v0_pre_varints )
    let HcA_v1_pre_varints =
	varint_bin_into_hex( HcA_v1_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcA_v1_bin.slice(    16 ))
    maybelog( "HcA v1 varints: 0x" + HcA_v1_pre_varints )
    let HcS_v0_pre_varints =
	varint_bin_into_hex( HcS_v0_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcS_v0_bin.slice(    16 ))
    maybelog( "HcS v0 varints: 0x" + HcS_v0_pre_varints )
    let HcS_v1_pre_varints =
	varint_bin_into_hex( HcS_v1_bin.slice( 0, 16 )) +
	varint_bin_into_hex( HcS_v1_bin.slice(    16 ))
    maybelog( "HcS v1 varints: 0x" + HcS_v1_pre_varints )

    // The 4-symbol prefixes + version (upper-case)
    let HcK_v0_pre = b32_holochain_encode_from_hex( HcK_v0_hex ).slice( 0, 4 )
    let HcK_v1_pre = b32_holochain_encode_from_hex( HcK_v1_hex ).slice( 0, 4 )
    let HcA_v0_pre = b32_holochain_encode_from_hex( HcA_v0_hex ).slice( 0, 4 )
    let HcA_v1_pre = b32_holochain_encode_from_hex( HcA_v1_hex ).slice( 0, 4 )
    let HcS_v0_pre = b32_holochain_encode_from_hex( HcS_v0_hex ).slice( 0, 4 )
    let HcS_v1_pre = b32_holochain_encode_from_hex( HcS_v1_hex ).slice( 0, 4 )

    let Hc_case_pre = '101'    // Desired prefix case encoding, eg. HcK...

    maybelog( "HcK v0 prefix:  " + map_bits_onto_case( Hc_case_pre, HcK_v0_pre ))
    maybelog( "HcK v1 prefix:  " + map_bits_onto_case( Hc_case_pre, HcK_v1_pre ))
    maybelog( "HcA v0 prefix:  " + map_bits_onto_case( Hc_case_pre, HcA_v0_pre ))
    maybelog( "HcA v1 prefix:  " + map_bits_onto_case( Hc_case_pre, HcA_v1_pre ))
    maybelog( "HcS v0 prefix:  " + map_bits_onto_case( Hc_case_pre, HcS_v0_pre ))
    maybelog( "HcS v1 prefix:  " + map_bits_onto_case( Hc_case_pre, HcS_v1_pre ))

    // How many Base-32 symbols encode the prefix.  The total number of 5 symbols contains 1 bit of
    // payload data, so will vary from message to message.  The first 4 are fixed and encode the key
    // type 'Hc{K,A,S}' and version number '{B,T}'.
    let Hc_b32_pre_syms_len = 5
    let Hc_b32_pre_type_len = 4

    // Perform the normal Crockford substitutions on Base-32; 'iIlL' -> 1, 'oO' => 0.  Also, find
    // any '_' (or other invalid symbols) erasure indicators, substitute them for 'A', and return
    // the array of Base-32 indices containing the indicated erasures.  Return the corrected
    // Base-32, retaining upper/lower case because it may encode Reed-Solomon parity.  Note that the
    // erasure indices are *not* the indices of the octet that got erased; just the Base-32 symbol;
    // a single symbol erasure may map to more than one octet (ie. indicate 2 Reed-Solomon
    // erasures); the caller is expected to do this mapping, and decide if the R-S codeword is
    // overwhelmed with the specified erasures.
    function b32_crockford_substitutions( b32 ) {
	let erasures = []
	let b32_sub = [...b32]
	    .map( (c,i) => {
		  switch ( c ) {
		  case '0': case '1': case '2': case '3': case '4':
		  case '5': case '6': case '7': case '8': case '9':
		  case 'A': case 'B': case 'C': case 'D': case 'E':
		  case 'F': case 'G': case 'H': case 'J': case 'K':
		  case 'M': case 'N': case 'P': case 'Q': case 'R':
		  case 'S': case 'T': case 'V': case 'W': case 'X':
		  case 'Y': case 'Z':
		  case 'a': case 'b': case 'c': case 'd': case 'e':
		  case 'f': case 'g': case 'h': case 'j': case 'k':
		  case 'm': case 'n': case 'p': case 'q': case 'r':
		  case 's': case 't': case 'v': case 'w': case 'x':
		  case 'y': case 'z':
		      return c

		  case 'i': case 'I': case 'l': case 'L':
		      return '1';

		  case 'o': case 'O':
		      return '0'

		  default: case '_':
		      // Explicit erasure, or a another clearly invalid symbol. The Base-32 data is
		      // wrong; the user may have accidentally substituted an invalid character.
		      // The best we can hope for is that, by marking the error as an erasure
		      // (because, clearly, we *don't know* what the value should be), that we can
		      // recover the correct data, using only a single Reed-Solomon parity symbol.
		      erasures.push( i )
		      // P(22/33) symbol was alpha, and P(.5) it was upper == P(.34357) guess has
		      // correct capitalization parity data.
		      return 'A'
		  }
	    })
	    .join('')

	return {
	    erasures,
	    b32_sub
	}
    }

    function b32_holochain_substitutions( b32 ) {
	let erasures = []
	let b32_sub = [...b32]
	    .map( (c,i) => {
		  switch ( c ) {
		  case '0':
		      return 'O'
		  case '1':
		  case 'L':
		      return 'I'
		  case 'l':
		      return 'i'
		  case '2':
		      return 'Z'
		      
		  case '3': case '4': case '5': case '6': case '7': case '8': case '9':
		  case 'A': case 'B': case 'C': case 'D': case 'E': case 'F': case 'G':
		  case 'H': case 'I': case 'J': case 'K':           case 'M': case 'N':
		  case 'O': case 'P': case 'Q': case 'R': case 'S': case 'T': case 'U':
		  case 'V': case 'W': case 'X': case 'Y': case 'Z':
		  case 'a': case 'b': case 'c': case 'd': case 'e': case 'f': case 'g':
		  case 'h': case 'i': case 'j': case 'k':           case 'm': case 'n':
		  case 'o': case 'p': case 'q': case 'r': case 's': case 't': case 'u':
		  case 'v': case 'w': case 'x': case 'y': case 'z':
		      return c

		  default: case '_':
		      // Explicit erasure, or a another clearly invalid symbol. The Base-32 data is
		      // wrong; the user may have accidentally substituted an invalid character.
		      // The best we can hope for is that, by marking the error as an erasure
		      // (because, clearly, we *don't know* what the value should be), that we can
		      // recover the correct data, using only a single Reed-Solomon parity symbol.
		      erasures.push( i )
		      // P(22/33) symbol was alpha, and P(.5) it was upper == P(.34357) guess has
		      // correct capitalization parity data.
		      return 'A'
		  }
	    })
	    .join('')

	return {
	    erasures,
	    b32_sub
	}
    }

    // Convert to/from Crockford Base-32.  Assumes all normal substitutions have already occurred,
    // and the 'b32' only contains valid Crockford Base-32 symbols.
    function b32_decode_into_hex( b32, base32_encoding ) {
	return Buffer.from( rfc4648.codec.parse(
	    b32.toUpperCase(), base32_encoding, { loose: true })).toString('hex')
    }

    function b32_crockford_decode_into_hex( b32 ) {
	return b32_decode_into_hex( b32, base32_crockford )
    }

    function b32_holochain_decode_into_hex( b32 ) {
	return b32_decode_into_hex( b32, base32_holochain )
    }

    function b32_encode_from_hex( hex, base32_encoding ) {
	let b32 = rfc4648.codec.stringify(
	    Buffer.from( hex, 'hex' ), base32_encoding )
	for ( var pads = 0; b32.length && b32[b32.length - pads - 1] === '='; ++pads ) {}
	return b32.slice( 0, b32.length - pads )
    }

    function b32_crockford_encode_from_hex( hex ) {
	return b32_encode_from_hex( hex, base32_crockford )
    }

    function b32_holochain_encode_from_hex( hex ) {
	return b32_encode_from_hex( hex, base32_holochain )
    }

    // Convert Base-32 indices of symbol(s) (default to 1 symbol) into the underlying octets offsets
    // their bit contributions impinge.  If a 'base_octet' is supplied, we'll add it to the computed
    // octet number.
    function b32_indices_to_octets( b, e, base_octet ) {
	let b_octet = (( b * 5 )     / 8 ) | 0
	if ( e == undefined )
	    e = b
	let e_octet = (( e * 5 + 4 ) / 8 ) | 0
	let result = [
	    b_octet + (base_octet || 0),
	    e_octet + (base_octet || 0)
	]
	maybelog( "Base-32 indices " + [b,e].join(', ') + " --> octets " + result.join(', ') )
	return result
    }

    // Return result of mixing mix_bits to 'into', 'every' number of bits.
    // 
    // Actually; do *not* intermix the parity.  If we do this, and there's an erasure somewhere in
    // the Base-32, then it will "infect" both the key octet it appears inside of, *and* probably
    // one bit of the distributed parity data, destroying 2 symbols of Reed-Solomon codeword!  Just
    // tack it to the end.
    function mix_bits_into( mix_bits, into, every ) {
	return into + mix_bits
	/*
	if ( mix_bits.length > into.length / every ) {
	    throw( "mix_bits: " + mix_bits + " too long for into: " + into + ", every: " + every )
	}
	let mixed = ''
	bits_offset = 0
	into_offset = 0
	while ( mix_bits.slice( bits_offset, bits_offset + 1 ).length > 0 ) {
	    // There are still some bits left.
	    mixed += into.slice( into_offset, into_offset + every )
	    mixed += mix_bits.slice( bits_offset, bits_offset + 1 )
	    into_offset += every
	    bits_offset += 1
	}
	// Return mix plus remaining into	
	return mixed + into.slice( into_offset )
	*/
    }

    // Return (bits, unmixed) of extracting 'num_bits' from 'outa', 'every' number of bits.
    // 
    // We are not actually mixing in the bits, to avoid an erasure infecting both a R-S codeword
    // data symbol *and* a parity symbol.  We've just tacked the mix_bits onto the end.
    function num_bits_outa( num_bits, outa, every ) {
	if ( num_bits > outa.length / ( every + 1 )) {
	    maybelog( "num_bits: " + num_bits + " too long for outa: " + outa + "(len: " + outa.length + "), every: " + every )
	    throw( "num_bits: " + num_bits + " too long for outa: " + outa + "(len: " + outa.length + "), every: " + every )
	}
	maybelog( "num_bits: " + num_bits + " validated for outa: " + outa + "(len: " + outa.length + "), every: " + every )
	return {
	    unmixed: outa.slice( 0, outa.length - num_bits ),
	    bits:    outa.slice(    outa.length - num_bits )
	}
	/*
	let bits = ''
	let unmixed = ''
	bits_offset = 0
	outa_offset = 0
	while (num_bits > bits_offset) {
	    // There are still some bits left to unmix.
	    unmixed += outa.slice( outa_offset + bits_offset, outa_offset + bits_offset + every )
	    outa_offset += every
	    bits += outa.slice( outa_offset + bits_offset, outa_offset + bits_offset + 1 )
	    bits_offset += 1
	}
	// Returns bits, unmixed plus remaining outa
	unmixed += outa.slice( outa_offset + bits_offset )
	return { bits, unmixed }
	*/
    }

    function hex_to_bin( hex ) {
	let bin = ''
	for ( let c of hex ) {
	    bin += parseInt(c,16).toString(2).padStart(4, '0')
	}
	return bin
    }

    function bin_to_hex( bin ) {
	let hex = ''
	let bin_offset = 0
	while ( bin.slice( bin_offset, bin_offset + 4 )) {
	    hex += parseInt( // pads any partial nibble out to 4 bits on right
		bin.slice( bin_offset, bin_offset + 4 ).padEnd(4, '0'),
		2 ).toString(16)
	    bin_offset += 4
	}
	return hex
    }

    function map_bits_onto_case( bits, alphanum ) {
	let out = ''
	let bits_offset = 0
	for ( let c of alphanum ) {
	    if ( '0123456789'.includes( c )) {
		out += c
		continue
	    }
	    // Take a bit (if any left): '', '0' -> 0, 1 -> 1	    
	    if ( Number( bits.slice( bits_offset, bits_offset + 1 ))) {
		out += c.toUpperCase()
	    } else {
		out += c.toLowerCase()
	    }
	    bits_offset += 1
	}
	return out
    }

    function get_bits_from_case( alphanum ) {
	return [...alphanum]
	    .map( c =>
		  ( '0123456789'.includes( c )
		    ? ''
		    : ( 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes( c )
			? '1'
			: '0')))
	    .join('')
    }
    
    // Computes how many segments of a Base-32 56-symbol key have enough alpha symbols to support an
    // octet of Reed-Solomon parity, to be encoded as capitalization.  Returns the alpha counts, a
    // flag for each segment that meets minimum, and a total count of R-S parity octets required.
    function b32_alpha_counts( b32, seg_len, minimum ) { // minimum defaults to 8
	let alphas = [] // eg. [ 9, 3, 12]
	let meets = [] // eg. [true, false, true]
	let total = 0
	let segments = b32.length / seg_len | 0 // any extras accrue to last segment
	for ( seg = 0; seg < segments; ++seg ) {
	    alphas[seg] = 0
	    for ( let c of b32.slice( seg * seg_len, seg * seg_len + seg_len )) {
		if ( 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.includes( c )) {
		    alphas[seg]++
		}
	    }
	    if ( alphas[seg] < ( minimum | 8 )) {
		meets[seg] = false
	    } else {
		meets[seg] = true
		total++
	    }
	}
	return {
	    alphas,
	    meets,
	    total
	}
    }

    // Map the provided octets_bin (eg. ['11110000',...,'10101010'] onto segments of the provided
    // Base-32, in the alpha symbols within each segment.  If insufficient alpha symbols are
    // available, map all alphas to lower case; the receiver will detect the lack of symbols and
    // ignore the data.
    function hc_encode_b32_case( b32, case_pre, case_bin ) {
	// How many symbols / segment to guarantee we cover *all* Base-32 symbols (except for the
	// first case_pre.length symbols)
	let seg_len = Math.ceil(( b32.length - case_pre.length ) / case_bin.length ) | 0
	let { alphas, meets, total } = b32_alpha_counts( b32, seg_len )
	maybelog("cap (#par): " + total)

	// We need (at least one) R-S parity octet(s).  Get them, and map them onto the
	// capitalizations in the correct segments of the Base-32 key that meets the alphas
	// threshold, leaving segments that don't meet the alphas threshold all lower case.
	let b32_case_enc = meets.map( (yes, i) => {
	    let seg = b32.slice( case_pre.length + i * seg_len,
				 case_pre.length + i * seg_len + seg_len )
	    if ( yes ) {
		let bits = case_bin[i]
		return map_bits_onto_case( bits, seg )
	    } else {
		maybelog("alpha low: " + alphas[i] + " in seg " + i + ": " + seg )
		return seg.toLowerCase()
	    }
	}).join('')
	maybelog("cap (case): " + b32_case_enc)
	// Return the desired prefix capitalizations, and the case-encoded b32
	return map_bits_onto_case( case_pre, b32.slice( 0, case_pre.length )) + b32_case_enc
    }

    // Extract and return parity data from the capitalization case of a Base-32 encoded 35-octet
    // key/hash/sig, ignoring the first case_pre.length Base-32 symbols.  If any octet of parity
    // cannot be extracted from its segment (insufficient alpha symbols in the segment), *or* if the
    // segment contains a known erasure, mark the octet of parity data as an erasure with a 'null'.
    // Assumes relevant Base-32 substitutions have occurred, and erasures have been deduced.
    // Returns eg. ['01001011',null,'11010011',null] indicating either parity data, or an erasure
    // ('null')
    function hc_decode_b32_case( b32, erasures, case_pre, segments ) {

	maybelog("correcting: " + b32 + " w/ erasures: " + erasures.join(', ')) 

	// How many symbols / segment to guarantee we cover *all* Base-32 symbols
	let seg_len = Math.ceil(( b32.length - case_pre.length ) / segments) | 0
	let { alphas, meets, total } = b32_alpha_counts( b32, seg_len, 8 )
	maybelog("cap (#par): " + total)

	// TODO: permute the 'meets' on any segment that 'meets' w/in +/- 1 alpha, in case an
	// alpha-numeric flip has occurred.  For now, fail if an alpha-numeric flip changes the
	// 'meets' criteria of a segment...
	
	// TODO: handle erasures and/or alpha-digit flips, by permuting the 'meets' criteria of any
	// segment in which an erasure occurs, and making it either not 'meets', or supply parity
	// but be marked as an erasure.

	let parity_bins = meets
	    .map( (yes, i) => {
		if ( yes ) {
		    // TODO: See if an erasure is indicated in this segment; if it comes after
		    // the last alpha used, that's OK.
		    for ( let s of erasures ) {
			if ( s >= case_pre.length + i * seg_len &&
			     s <  case_pre.length + i * seg_len + seg_len ) {
			    // this erasure is within this block of b32 data; it's an erasure.
			    return null
			}
		    }
		    let bits =
			get_bits_from_case(
			    b32.slice( case_pre.length + i * seg_len,
				       case_pre.length + i * seg_len + seg_len ))
			.slice( 0, 8 ) // may be more than 8 alphas in the segment
		    return bits
		}
		return null // insufficient alphas in this segment
	    })

	// If all are upper/lower, then assume that capitalization has been lost.
	if ( parity_bins.every( p => p == null || p == '11111111' )
	     || parity_bins.every( p => p == null || p == '00000000' )) {
	    maybelog( "No varying capitalization data; returning " + total + " erasures" )
	    parity_bins.fill( null )
	}
	maybelog( "caps (bin): " + parity_bins.join(', '))
	return parity_bins
    }
    
    // Transform a 256-bit 32-octet hex key into a 38-octet Base-32 encoded key in 63 symbols with
    // the provided 3-octet prefix.  4 Reed-Solomon parity octets are intermixed into the key data,
    // and another 0-4 octets encoded into the Base-32 alpha character capitalization.  Returns the
    // 63-symbol Base-32 encoded value.
    function hc_encode_hex_into_b32( key32_hex, pre3_hex, case_pre ) {
	// Produce 8 octets of R-S parity over the base key, for distribution into the key data (4
	// octets), and into the Base-32 capitalization.  This validates that any recovered key is
	// fundamentally correct, with high confidence.
	maybelog("Encode key: " + key32_hex )

	let par_num = 8 // must be even or hex slicing to work
	const enc = new Encoder(par_num)

	let key32_ecc = enc.encode(Buffer.from(key32_hex, 'hex'))
	let key32_ecc_hex = key32_ecc.toString('hex')
	maybelog("key + rs:   " + key32_ecc_hex )

	const par = key32_ecc_hex.slice(key32_hex.length) // extracts the 8 octets parity
	const par_mix = par.slice( 0, par_num )
	const par_cap = par.slice( par_num )

	let key32_bin = hex_to_bin( key32_hex )
	maybelog("key (bin):  " + key32_bin) // 256 bits
	let par_mix_bin = hex_to_bin( par_mix )
	maybelog("mix (bin):  " + par_mix_bin) // 32 bits
	let par_cap_bin = hex_to_bin( par_cap )
	maybelog("cap (bin):  " + par_cap_bin) // 32 bits
	let par_mix_step = key32_bin.length / par_mix_bin.length | 0 // 256 / 32 == 8
	let key36_bin = mix_bits_into( par_mix_bin, key32_bin, par_mix_step )
	maybelog("mixed (" + par_mix_step + "):   " + key36_bin)
	let key36_hex = bin_to_hex( key36_bin )
	maybelog("key + par:  " + key36_hex) // 35 octets

	let key39_b32 = b32_holochain_encode_from_hex( pre3_hex + key36_hex )
	maybelog("k+p base32: " + key39_b32) // 63 Base-32 symbols (padding discarded)

	// We now have the 39-octet prefix + mixed key+parity.  Create the 0-4 octet caps parity;
	// this depends on the number of alpha characters in the Base-32 encoding, rounded to full
	// octets.  We will split the 63-3 == 60 symbols into 4 parts of 15 symbols; each should
	// have 15 * 25/32 == ~11.72 alpha symbols on average for "random" data.  If not at least 8,
	// then the segment's capitalization parity is discarded.  So, we may have from 0 to 4 R-S
	// parity symbols encoded in the capitalization.
	let cap_bins = [...Array(par_num/2).keys()]
	    .map( i => par_cap_bin.slice( i*8, i*8+8 ))

	maybelog("cap bins:   " + cap_bins.join(', '))

	let key39_b32_case = hc_encode_b32_case( key39_b32, case_pre, cap_bins )
	maybelog("k+p w/case: " + key39_b32_case) // 56 base32 upper/lower case w/ parity
	
	return key39_b32_case
    }
exports.hexToBase32 = hc_encode_hex_into_b32

    function hc_decode_hex_from_b32( key39_b32_case, case_pre ) {
	maybelog("Decode key  " + key39_b32_case )

	// Canonicalize the Base-32; perform any substitutions, find erasures, replacing with
	// "valid" symbols; may corrupt any capitalization-based source data impinged by erasures,
	// but the resultant sub.b32 will Base-32 decode.
	let sub = b32_holochain_substitutions( key39_b32_case ) // { b32_sub, erasures }
	maybelog("after sub:  " + sub.b32_sub + ", erasures: " + sub.erasures.join( ', ' ))

	// Extract an array of 4 ['11010011',null,...] parity data from alpha case. May contain
	// 'null', if insufficient alphas, or erasures impinged.
	let cap_bins = hc_decode_b32_case( sub.b32_sub, sub.erasures, case_pre, 4 )

	// Get the 39-octet codeword from the canonicalized Base-32.  This contains the 3 prefix
	// octets (6 hex digits); remove them.
	let key39_hex = b32_holochain_decode_into_hex( sub.b32_sub )
	let key36_hex = key39_hex.slice( 6 )
	let key36_bin = hex_to_bin( key36_hex )
	maybelog("key36 bin:  " + key36_bin)

	// Extract the bits mixed into the 36-octet key payload, and get the 32-octet unmixed.  4
	// octets (32 bits) over a 36-octet 288 bit payload is every 8th bit.
	let par_data = num_bits_outa( 32, key36_bin, 8 )
	maybelog("key unmix:  " + par_data.unmixed)
	maybelog("par unmix:  " + par_data.bits)

	// TODO: permute the cap_bins, to see if removing some of them improves our recovery

	// Compute the octet offsets of any key39 erasures found, into the key36 octets (with the
	// first 3 octets removed).  Thus, if there was an erasure in the leading 3 octets, we'll
	// ignore it.
	maybelog("b32 eras.:  " + sub.erasures.join(', '))
	let key36_beg_octets = sub.erasures
	    .map( p => b32_indices_to_octets( p, p, -3 )[0] )
	    .filter( v => v >= 0 )
	let key36_end_octets = sub.erasures
	    .map( p => b32_indices_to_octets( p, p, -3 )[0] )
	    .filter( v => v >= 0 ) // allows 'null's to pass..
	
	// Re-map the caps parity erasures (in Base-32 symbols) into octet offsets.  These octets of
	// caps-mapped parity data begin after the 32-octet key + 4 octets of key-mixed parity, so
	// offset 36.  Discard 'null', and dedupe using Set.  Remember, we use the index (eg. the
	// i'th cap parity blob) to locate which parity octet is missing.
	maybelog("caps miss:  " + cap_bins.map( (p,i) => p ? null : i ).filter( v => v !== null ).join(', '))
	let cap_par_beg_octets = cap_bins
	    .map( (p,i) => p ? null : b32_indices_to_octets( i, i, 36 )[0] )
	let cap_par_end_octets = cap_bins
	    .map( (p,i) => p ? null : b32_indices_to_octets( i, i, 36 )[1] )
	let erasures_octet = [...new Set(
	    key36_beg_octets
		.concat( key36_end_octets )
		.concat( cap_par_beg_octets )
		.concat( cap_par_end_octets )
		.filter( v => v !== null )
	).keys()]

	maybelog("par eras.:  " + erasures_octet.join(', '))

	const dec = new Decoder(8)
	let key32_hex = bin_to_hex( par_data.unmixed )
	let par_mix_hex = bin_to_hex( par_data.bits )
	let par_cap_hex = bin_to_hex( cap_bins.map( b => b === null ? '00000000' : b ).join('') )
	maybelog("par mix:    " + par_mix_hex)
	maybelog("par cap:    " + par_cap_hex)
	let key32_ecc = Buffer.from( key32_hex + par_mix_hex + par_cap_hex, 'hex' )
	let key32_era = Buffer.from( erasures_octet )
	let key32_fix = dec.correct( key32_ecc, key32_era )

	return key32_fix.toString('hex').slice( 0, 32*2 )
    }

    // Detects what kind of blob it is, decodes and validates it, returning the result or throwing an error
    function hc_decode_from_b32( b32, case_pre ) {
	// First 4 Base-32 symbols are prefix; eg. 'HcK' + 'B' (version 0), 'T' (version 1)
	let prefix = b32.slice( 0, Hc_b32_pre_type_len ).toUpperCase()
	switch( prefix ) {
	case HcK_v0_pre:
	case HcA_v0_pre:
	case HcS_v0_pre:
	    if ( b32.length != 63 )
		throw( "Holochain " + prefix + " Base-32 encoding should be 63 symbols in length" )
	    return {
		prefix: map_bits_onto_case( case_pre || Hc_case_pre, prefix),
		data: hc_decode_hex_from_b32( b32, case_pre || Hc_case_pre )
	    }
	default:
	    maybelog( "Unrecognized prefix: " + prefix + " == 0x" + prefix )
	    throw( "Unrecognized prefix: " + prefix_b32 + " == 0x" + prefix )
	}
    }


    // XOR the given char w/ the 'xor' bits, and return the char
    function xor_char( c, xor ) {
	return String.fromCharCode( c.charCodeAt( 0 ) ^ xor )
    }

    function carets_at( offsets, c ) {
	out = new Array(Math.max(...offsets) + 1).fill(' ')
	for ( let o of offsets )
	    out[o] = c || '^'
	return out.join('')
    }

function main () {
    maybelog( "\nTest Key, Address round-trip w/o error" )
    let signing = randomHex( 256/8 )
    maybelog( "HcK out:    " + signing )
    let key39_b32 = hc_encode_hex_into_b32( signing, HcK_v0_hex, Hc_case_pre )
    maybelog( "HcK B32:    " + key39_b32 )
    let signing_rec = hc_decode_from_b32( key39_b32 )
    maybelog( signing_rec.prefix + " recov: " + signing_rec.data )

    let address = randomHex( 256/8 )
    maybelog( "HcA out:    " + address )
    let adr39_b32 = hc_encode_hex_into_b32( address, HcA_v0_hex, Hc_case_pre )
    maybelog( "HcA B32:    " + adr39_b32 )
    let address_rec = hc_decode_from_b32( adr39_b32 )
    maybelog( address_rec.prefix + " recov: " + address_rec.data )
    let err_idx = []
    while ( err_idx.length < 5 ) {
	// error anywhere after 5-symbol prefix (type+size)
	err_idx.push( getRandomInt( Hc_b32_pre_type_len, key39_b32.length-1 ))
	maybelog( "\nTest Key, Address round-trip w/ " + err_idx.length + " erasure(s)" )
	key39_b32_era = key39_b32
	for ( let e of err_idx )
	    key39_b32_era = key39_b32_era.slice( 0, e ) + '_' + key39_b32_era.slice( e + 1 )
	maybelog( "HcK B32:    " + key39_b32 )
	maybelog( "HcK Erase:  " + key39_b32_era )
	maybelog( "Erasure:    " + carets_at( err_idx ))
	try {
	    let key39_b32_era_rec = hc_decode_from_b32( key39_b32_era, Hc_case_pre )
	    maybelog( key39_b32_era_rec.prefix + " recov: " +  key39_b32_era_rec.data )
	} catch ( e ) {
	    maybelog( "Fail recov: " + e )
	}

	maybelog( "\nTest Key, Address round-trip w/ " + err_idx.length + " errors(s)" )
	key39_b32_err = key39_b32
	for ( let e of err_idx )
	    key39_b32_err = key39_b32_err.slice( 0, e ) + xor_char( key39_b32_err[e], e ) + key39_b32_err.slice( e + 1 )
	maybelog( "HcK B32:    " + key39_b32 )
	maybelog( "HcK Error:  " + key39_b32_err )
	maybelog( "Error:      " + carets_at( err_idx ))
	try {
	    let key39_b32_err_rec = hc_decode_from_b32( key39_b32_err, Hc_case_pre )
	    maybelog( key39_b32_err_rec.prefix + " recov: " +  key39_b32_err_rec.data )
	} catch ( e ) {
	    maybelog( "Fail recov: " + e )
	}
}
}

exports.main = main
