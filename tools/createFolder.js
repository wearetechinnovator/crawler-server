const { tool } = require("@langchain/core/tools");
const { z } = require('zod');
const { mkdir } = require("fs/promises");


const createFolderTool = tool(
    async ({ folderName }) => {
        try {
            await mkdir(folderName);

            return {
                success: true,
                message: `Folder "${folderName}" created successfully.`,
            };
        } catch (err) {
            return {
                success: false,
                message: err.message,
            };
        }
    },
    {
        name: 'createFolder',
        description: 'if user say create new folder or directory so you use this tool, you give a folder or directory name',
        schema: z.object({
            folderName: z.string().describe('a folder name user create this')
        })
    }
)

module.exports = {
    createFolderTool
}