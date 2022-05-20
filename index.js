const express = require('express')
const app = express()
const port = 80
const bodyParser = require('body-parser');
const { default: axios } = require('axios');
const token = '1/1200269502377503:f7929c54d161b63a506ebfdfd2a5f1c1'
const tag_map = {
    "first_assignment": "1202310909870479",
    "first_reply": "1202311205567759"
}

const field_map = {
    "first_assignment": 1202311205567770,
    "first_reply": 1202311205567772
}

app.use(bodyParser.urlencoded({
    extended: false
 }));
 
 app.use(bodyParser.json());

// app.get('/', (req, res) => {
//   res.send('Hello World!')
// })

app.post('/', (req, res) => {
    // res.set('Content-Type', 'text/plain');
    if (req.headers['x-hook-secret']) {
        res.set('x-hook-secret', req.headers['x-hook-secret'])
    }
    console.log(req.body)
    res.send(req.body)
    // res.send('This is a post')
})

// app.post('/task', (req, res) => {
//     // res.set('Content-Type', 'text/plain');
//     if (req.headers['x-hook-secret']) {
//         res.set('x-hook-secret', req.headers['x-hook-secret'])
//     }
//     if (req.body) {
//         req.body && console.log(JSON.stringify(req.body, null, 2))
//         res.send(req.body)
//     } else {
//         res.send('received')
//     }
//     // req.body && console.log(JSON.stringify(req.body, null, 2))
//     // res.send(req.body)
//     // res.send('This is a post')
// })

app.post('/story', async (req, res) => {
    // res.set('Content-Type', 'text/plain');
    if (req.headers['x-hook-secret']) {
        res.set('x-hook-secret', req.headers['x-hook-secret'])
    }
    if (req.body) {
        for (let event of req.body.events) {
            console.log(JSON.stringify(event, null, 2))
            let type = event.resource.resource_type;
            let subtype = event.resource.resource_subtype
            let updateId = event.resource.gid
            let parent = event.parent
            let actor = event.user && event.user.resource_type === 'user' ? event.user.gid : 'non-user'
            if (type === 'story' && subtype === 'assigned') {
                console.log('story update detected')
                let task = await getTask(parent.gid).catch(error => {
                    console.log('get task error')
                    console.log(error)
                })
                console.log('task process complete')
                if (task && task.data && !task.data.tags.includes('first_assignment') && parent.gid === '1202310745387971') {
                    console.log('adding assignment tag')
                    addTag(parent.gid, 'first_assignment').catch(error => {
                        console.log('add tag error')
                        console.log(error)
                    })
                    await updateTask(parent.gid, field_map['first_assignment'], timestamp()).catch(error => {
                        console.log('update task error')
                        console.log(error)
                    })
                } else {
                    console.log('tag already assigned')
                }
            }

            if (type === 'story' && subtype === 'comment_added') {
                console.log('story update detected')
                let task = await getTask(parent.gid).catch(error => {
                    console.log('get task error')
                    console.log(error)
                })
                console.log('task process complete')
                if (task && task.data && task.data.assignee !== null && task.data.assignee.gid === actor && !task.data.tags.includes('first_reply') && parent.gid === '1202310745387971') {
                    console.log('adding first reply tag')
                    await addTag(parent.gid, 'first_reply').catch(error => {
                        console.log('add tag error')
                        console.log(error)
                    })
                    await updateTask(parent.gid, field_map['first_reply'], timestamp()).catch(error => {
                        console.log('update task error')
                        console.log(error)
                    })
                } else {
                    console.log('tag already assigned')
                }
            }
        }
        res.send(req.body)
    } else {
        res.send('received')
    }
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

function getTask(gid) {
    console.log('getting task...', gid)
    return axios.get(`https://app.asana.com/api/1.0/tasks/${gid}?opt_fields=assignee,name,tags,permalink_url`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    }).then(
        result => {
            console.log(JSON.stringify(result.data, null, 2))
            return result.data
        },
        error => {
            console.log(error.response.data)
        }
    )
}

function addTag(gid, tagName) {
    console.log('adding tag...', gid)

    const data = {
        data: {
            tag: tag_map[tagName]
        }
    }
    const options = {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'content-type': 'application/json' 
        },
        data: JSON.stringify(data),
        url: `https://app.asana.com/api/1.0/tasks/${gid}/addTag`,
    };
    return axios(options).then(
        result => {
            console.log(JSON.stringify(result.data, null, 2))
            return result.data
        },
        error => {
            console.log(error.response.data)
        }
    )
}

function updateTask(gid, field, value) {
    console.log('adding tag...', gid)

    const data = {
        data: {
            custom_fields: {
                [field]: value
              }            
        }
    }
    const options = {
        method: 'PUT',
        headers: { 
            'Authorization': `Bearer ${token}`,
            'content-type': 'application/json' 
        },
        data: JSON.stringify(data),
        url: `https://app.asana.com/api/1.0/tasks/${gid}`,
    };
    return axios(options).then(
        result => {
            console.log(JSON.stringify(result.data, null, 2))
            return result.data
        },
        error => {
            console.log(error.response.data)
        }
    )
}

function timestamp() {
    return String(Math.floor(Date.now() / 1000))
}