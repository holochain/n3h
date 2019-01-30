<a name="module_type"></a>

## type
Library for runtime type checking


* [type](#module_type)
    * [~is](#module_type..is) : <code>object</code>
    * [~a](#module_type..a) : <code>object</code>
    * [~an](#module_type..an) : <code>object</code>
    * [~assert](#module_type..assert) : <code>object</code>
    * [~not](#module_type..not) : <code>object</code>
    * [~arrayOf](#module_type..arrayOf) : <code>object</code>
    * [~addModifier(n, f)](#module_type..addModifier)
    * [~addTerminal(n, f)](#module_type..addTerminal)
    * [~string(v)](#module_type..string)
    * [~number(v)](#module_type..number)
    * [~object(v)](#module_type..object)

<a name="module_type..is"></a>

### type~is : <code>object</code>
fluent no-op

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..a"></a>

### type~a : <code>object</code>
fluent no-op

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..an"></a>

### type~an : <code>object</code>
fluent no-op

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..assert"></a>

### type~assert : <code>object</code>
Throw an error if the following chain results evaluate to false

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..not"></a>

### type~not : <code>object</code>
Negate the following chain results

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..arrayOf"></a>

### type~arrayOf : <code>object</code>
1 - ensure the current value is an array
2 - ensure all array components pass their following chain evaluations

Note, empty arrays will always evaluate successfully

**Kind**: inner namespace of [<code>type</code>](#module_type)  
<a name="module_type..addModifier"></a>

### type~addModifier(n, f)
A modifier is either a no-op word, or a get-handler function
if it is a function, the signature is:
   (value, sprue, executor) => { ... }
where:
 - `value` is the current value in the fluent chain
 - `sprue` is an array of handler functions yet to be processed
 - `executor` should be called to process the next action
              executor signature (value, sprue) => { ... }

`sprue` will be emptied for each invocation of executor,
if you need to execute multiple times, you should clone with `sprue.slice(0)`
see the `arrayOf` builtin modifier for an example.

**Kind**: inner method of [<code>type</code>](#module_type)  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>string</code> | name of the modifier |
| f | <code>function</code> | the modifier handler function |

<a name="module_type..addTerminal"></a>

### type~addTerminal(n, f)
A "Terminal" presents itself as an actual function, taking a value,
that triggers the fluent chain type evaluation.
That is, the `string` in `type.assert.string('test')`.

The terminal handler function should follow the signature:

  (value) => { return bool }

Where:
  - `value` is the value to type check
  - `bool` is a boolean return value indicating the check result

**Kind**: inner method of [<code>type</code>](#module_type)  

| Param | Type | Description |
| --- | --- | --- |
| n | <code>string</code> | name of the terminal |
| f | <code>function</code> | the terminal handler function |

<a name="module_type..string"></a>

### type~string(v)
is the value a string

**Kind**: inner method of [<code>type</code>](#module_type)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>\*</code> | value |

<a name="module_type..number"></a>

### type~number(v)
is the value a number

**Kind**: inner method of [<code>type</code>](#module_type)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>\*</code> | value |

<a name="module_type..object"></a>

### type~object(v)
is the value an object? (not null, not array)

**Kind**: inner method of [<code>type</code>](#module_type)  

| Param | Type | Description |
| --- | --- | --- |
| v | <code>\*</code> | value |

