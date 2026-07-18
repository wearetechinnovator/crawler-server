const sendDataToFrontEnd = ({ hookData, req, res }) => {
    console.log(hookData);

    return res.status(200).json({
        msg: "Query executed successfully",
        data: hookData,
        type: "form"
    });
}

module.exports = {
    sendDataToFrontEnd
}