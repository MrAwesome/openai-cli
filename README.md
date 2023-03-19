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

Basic use:

![2023-02-09_20:16:35](https://user-images.githubusercontent.com/145945/217999281-e23ca27e-6104-4fcb-b6e3-c34d70528cdd.png)

Changing temperature:

![2023-03-18_21:56:31](https://user-images.githubusercontent.com/145945/226154525-db7f9e53-7693-4e88-a6e1-c612d3d32378.png)

Reading from a file:

![2023-03-18_22:00:05](https://user-images.githubusercontent.com/145945/226154631-512ef3b8-5daa-49dd-b6ff-62635361c458.png)

Get freaky:

![2023-03-18_22:04:54](https://user-images.githubusercontent.com/145945/226154808-37dd924a-0627-420a-a6ed-097c654bea8d.png)
