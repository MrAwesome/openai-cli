# openai-cli

NOTE: This is very much under construction right now, so there are still a few rough edges. Please file an issue or contact me directly if you find problems.

## Installation

### Fetch the code
``` 
git clone git@github.com:MrAwesome/openai-cli.git
# or https://github.com/MrAwesome/openai-cli.git
```

### Install dependencies:

```
cd openai-cli
yarn
```

### Add convenience alias:

Add this to your shell config (`.zshrc`, `.bashrc`, etc.):

```
ai() {
    SCRIPT_DIR="${HOME}/openai-cli"
    yarn \
        --cwd="${SCRIPT_DIR}" \
        run -s ts-node \
        "${SCRIPT_DIR}/src/index.ts" openai-completion $*
}
```

## Examples

### Console
![2023-02-09_20:16:35](https://user-images.githubusercontent.com/145945/217999281-e23ca27e-6104-4fcb-b6e3-c34d70528cdd.png)
