const { default: axios } = require('axios');

// environment variable strings
const TOKEN = process.env.TOKEN
let CARDS_TO_INCLUDE = process.env.CARDS_TO_INCLUDE
let CARDS_TO_EXCLUDE = process.env.CARDS_TO_EXCLUDE
const FIRST_ASSIGNMENT_TAG_ID = process.env.FIRST_ASSIGNMENT_TAG_ID
const FIRST_REPLY_TAG_ID = process.env.FIRST_REPLY_TAG_ID
const FIRST_ASSIGNMENT_FIELD_ID = process.env.FIRST_ASSIGNMENT_FIELD_ID
const FIRST_REPLY_FIELD_ID = process.env.FIRST_REPLY_FIELD_ID

// environment variable processing
CARDS_TO_INCLUDE = CARDS_TO_INCLUDE.split(',')
CARDS_TO_INCLUDE = CARDS_TO_INCLUDE.map(cardId => cardId.trim())

CARDS_TO_EXCLUDE = CARDS_TO_EXCLUDE.split(',')
CARDS_TO_EXCLUDE = CARDS_TO_EXCLUDE.map(cardId => cardId.trim())

const TAG_ID_MAP = {
    "first_assignment": FIRST_ASSIGNMENT_TAG_ID,
    "first_reply": FIRST_REPLY_TAG_ID
}

const FIELD_ID_MAP = {
    "first_assignment": Number(FIRST_ASSIGNMENT_FIELD_ID),
    "first_reply": Number(FIRST_REPLY_FIELD_ID)
}

// TODO: remove explicit number conversion
// TODO: simplify logging

exports.handler = async function (event, context) {

  const res = {
          headers: {}
        },
        req = event;

  if (req.headers['x-hook-secret']) {
      res.headers['x-hook-secret'] = req.headers['x-hook-secret']
  }

  const body = JSON.parse(req.body)
  if (body && body.events) {
      for (let event of body.events) {
          console.log(JSON.stringify(event, null, 2))
          const taskQualified = doesTaskQualify(event.parent.gid)
          let type = event.resource.resource_type;
          let subtype = event.resource.resource_subtype
          let updateId = event.resource.gid
          let parent = event.parent
          let actor = event.user && event.user.resource_type === 'user' ? event.user.gid : 'non-user'

          // first assignment
          if (type === 'story' && subtype === 'assigned') {
              console.log('story update detected - assigned')
              let task = await getTask(parent.gid).catch(error => {
                  console.log('error getting task')
                  console.log(error)
              })

              if (task && task.data && !task.data.tags.includes('first_assignment') && taskQualified) {
                  console.log('adding assignment tag')
                  addTag(parent.gid, 'first_assignment').catch(error => {
                      console.log('error adding tag')
                      console.log(error)
                  })
                  await updateTask(parent.gid, FIELD_ID_MAP['first_assignment'], timestamp()).catch(error => {
                      console.log('error updating task')
                      console.log(error)
                  })
              } else {
                  console.log('task does not qualify')
              }
          }

          // first comment from assignee
          if (type === 'story' && subtype === 'comment_added') {
              console.log('story update detected - comment_added')
              let task = await getTask(parent.gid).catch(error => {
                  console.log('error getting task')
                  console.log(error)
              })

              if (task && task.data && task.data.assignee !== null && task.data.assignee.gid === actor && !task.data.tags.includes('first_reply') && taskQualified) {
                  console.log('adding first reply tag')
                  await addTag(parent.gid, 'first_reply').catch(error => {
                      console.log('error adding tag')
                      console.log(error)
                  })
                  await updateTask(parent.gid, FIELD_ID_MAP['first_reply'], timestamp()).catch(error => {
                      console.log('error updating task')
                      console.log(error)
                  })
              } else {
                  console.log('task does not qualify')
              }
          }
      }

    res.statusCode = res.statusCode ? res.statusCode : 200
    res.body = JSON.stringify({
      message: `received - body: ${JSON.stringify(event)}`
    })
    return res

  } else {

    res.statusCode = 200
    res.body = JSON.stringify({
      message: `received - no appropriate body: ${JSON.stringify(event)}`
    })
    return res

  }
}

function doesTaskQualify(gid) {
    if (CARDS_TO_INCLUDE) {
        return CARDS_TO_INCLUDE.includes(gid)
    } else if (CARDS_TO_EXCLUDE) {
        return !CARDS_TO_EXCLUDE.includes(gid)
    } else {
        return true
    }
}

function getTask(gid) {
    console.log(`getting task ${gid}`)
    return axios.get(`https://app.asana.com/api/1.0/tasks/${gid}?opt_fields=assignee,name,tags,permalink_url`, {
        headers: {
            'Authorization': `Bearer ${TOKEN}`
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
    console.log(`adding tag ${tagName} to card ${gid}`)

    const data = {
        data: {
            tag: TAG_ID_MAP[tagName]
        }
    }
    const options = {
        method: 'POST',
        headers: { 
            'Authorization': `Bearer ${TOKEN}`,
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
    console.log(`updating custom field ${field} with value ${value} for card ${gid}`)

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
            'Authorization': `Bearer ${TOKEN}`,
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