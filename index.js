// 导入 express 模块
const express = require('express')
// 创建 express 的服务器实例
const app = express()

const jwt = require('jsonwebtoken')
const config = require('./config.js')

// 配置表单数据中间件
app.use(express.urlencoded({ extended: false }))
// 支持json数据
app.use(express.json());

// 导入 cors 中间件
const cors = require('cors')
// 将 cors 注册为全局中间件
app.use(cors())

// 创建路由对象
const router = express.Router()

// const fs = require('fs')

// 读取 data.json 文件，并将其解析为一个 JavaScript 对象
// const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'))

// const mysql = require('mysql')
const db = require('./db')

app.use((req, res, next) => {
  res.cc = function (err, status = 1) {
    res.send({
      status,
      message: err instanceof Error ? err.message : err,
    })
  }
  next();
})

app.use(router)

// 进行登录验证并返回状态以及token信息
router.post('/login', (req, res) => {
  const sql1 = `select * from userinfo where username = ? `

  //   调用 db.query() 执行 SQL 语句并传参：
  db.query(sql1, req.body.username, (err, result) => {
    //    console.log(results);
    //    console.log(req.body);
    // console.log(result);

    if (result.length === 0) { res.json({ status: 0, message: '用户不存在' }); return; }

    const compareResult = req.body.password === result[0].password;
    if (!compareResult) { res.json({ status: 100, message: '密码错误', }); return; }

    const user = { ...result[0], password: '', user_pic: '' }
    //对用户的信息进行加密生成Token字符串
    const tokenStr = jwt.sign(user, config.secretKey, { expiresIn: config.expiresIn })
    console.log(tokenStr);

    res.json({ status: 200, message: '成功', result, token: 'Bearer ' + tokenStr });
  }
  )

})


// 返回左侧菜单栏数据
router.get('/menus', async (req, res) => {
  try {
    const array = [];

    const queryMainTable = 'SELECT id, authName, path FROM main_table';
    const mainResults = await new Promise((resolve, reject) => {
      db.query(queryMainTable, (err, results) => {
        if (err) reject(err);
        else resolve(results);
      });
    });

    for (const mainResult of mainResults) {
      const data = {
        id: mainResult.id,
        authName: mainResult.authName,
        path: mainResult.path,
        children: [],
      };

      const queryUserTable = 'SELECT id, authname , path FROM users_table WHERE main_table_id = ?';
      const userResults = await new Promise((resolve, reject) => {
        db.query(queryUserTable, [data.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      data.children.push(...userResults);


      const queryrightTable = 'SELECT id, authname,path FROM rights_table WHERE main_table_id = ?';
      const rightResults = await new Promise((resolve, reject) => {
        db.query(queryrightTable, [data.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      data.children.push(...rightResults);

      const querygoodsTable = 'SELECT id, authname,path FROM goods_table WHERE main_table_id = ?';
      const goodsResults = await new Promise((resolve, reject) => {
        db.query(querygoodsTable, [data.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      data.children.push(...goodsResults);

      const queryordersTable = 'SELECT id, authname,path FROM orders_table WHERE main_table_id = ?';
      const ordersResults = await new Promise((resolve, reject) => {
        db.query(queryordersTable, [data.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      data.children.push(...ordersResults);

      const queryreportsTable = 'SELECT id, authname,path FROM reports_table WHERE main_table_id = ?';
      const reportsResults = await new Promise((resolve, reject) => {
        db.query(queryreportsTable, [data.id], (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });
      data.children.push(...reportsResults);



      array.push(data);
    }

    res.json({
      array,
      meta: {
        msg: '获得菜单列表成功',
        status: 200,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 分页返回用户列表信息
router.get('/users', async (req, res) => {
  try {
    console.log(req.query);
    const queryInfo = req.query;
    console.log(queryInfo);
    console.log(queryInfo.pagenum);

    const getUserinfoResults = async (queryInfo) => {
      return new Promise((resolve, reject) => {
        const userinfoTable = 'SELECT * FROM userinfo';
        db.query(userinfoTable, (err, results) => {
          if (err) reject(err + queryInfo);
          else {
            // console.log(queryInfo);
            // console.log(169);
            // const {pagenum, pagesize } = queryInfo;
            const pagenum = queryInfo.pagenum;
            const pagesize = queryInfo.pagesize;
            const startIndex = (pagenum - 1) * pagesize;
            const endIndex = parseInt(startIndex) + parseInt(pagesize);
            // console.log(startIndex,endIndex,175);
            const selectedResults = results.slice(startIndex, endIndex);
            resolve(selectedResults);
          }
        });
      });
    };


    const getUserinfoRowCount = async () => {
      return new Promise((resolve, reject) => {
        const userinfoTable = 'SELECT COUNT(*) AS rowCount FROM userinfo';
        db.query(userinfoTable, (err, results) => {
          if (err) reject(err);
          else {
            const rowCount = results[0].rowCount;
            resolve(rowCount);
          }
        });
      });
    };

    const userinfoResults = await getUserinfoResults(queryInfo);
    const userinfoRowCount = await getUserinfoRowCount(queryInfo);

    const response = {
      total: userinfoRowCount,
      pagenum: userinfoRowCount / queryInfo.pagesize,
      users: userinfoResults,
      meta: {
        msg: 'Successfully retrieved user list',
        status: 200,
      },
    };
    // console.log(response);
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

// 更改用户状态
router.put('/users/:id/state/:manage_state', async (req, res) => {
  // 从请求参数和请求体中获取用户 ID 和新的 manage_state 值
  const userId = req.params.id;
  const newManageState = req.params.manage_state;

  try {
    // 执行数据库更新操作
    const updateQuery = 'UPDATE userinfo SET manage_state = ? WHERE id = ?';
    await db.query(updateQuery, [newManageState, userId]);

    // 查询更新后的数据
    // const selectQuery = 'SELECT * FROM userinfo WHERE id = ?';
    // const updatedRow = await db.query(selectQuery, [userId]);

    // 返回包含更新后数据的 JSON 响应
    res.json("seccess");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update manage_state' });
  }
});

// 使用姓名搜索用户信息
router.post('/search', (req, res) => {
  // 从请求参数和请求体中获取姓名 
  // console.log(243);
  // console.log(req);
  // console.log(req.body);
  // console.log(246);
  // const uname = req.body.query;  
  // 执行数据库更新操作
  const searchQuery = 'select * from userinfo where username = ?';
  db.query(searchQuery, req.body.query, (err, result) => {
    // console.log(err);
    // console.log(252);
    // console.log(result);
    // console.log(object);
    if (result.length === 0) { res.json({ status: 0, message: '用户不存在' }); return; }
    else { res.json({ status: 200, message: '成功', result }) }

  });
});
// 按钮添加新用户
router.post('/regUser', (req, res) => {
  console.log(req.body);
  const addForm = req.body; // 获取传递的 addForm 数据
  console.log(addForm);
  const insertQuery = 'INSERT INTO userinfo (username, password, email, mobile) VALUES (?, ?, ?, ?)'; // 根据你的数据库表和字段名称进行调整

  const values = [addForm.username, addForm.password, addForm.email, addForm.mobile]; // 构建插入的数值数组，和 INSERT INTO 中字段对应

  db.query(insertQuery, values, (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ status: 500, message: '服务器错误' });
      return;
    }

    res.json({ status: 201, message: '插入成功' });
  });
});
// 修改按钮根据id查找信息
router.get('/bid',(req,res)=>{
   console.log(req.query);
   const id = req.query.id;
   const bidQuery = 'select id,username,role_name,mobile,email from userinfo where id = ?';
   db.query(bidQuery,id,(err,result)=>{
    if (err) {
      console.error(err);
      res.status(500).json({ status: 500, message: '服务器错误' });
      return;
    }

    res.json({ status: 201, message: '插入成功',result });
   })
});
// 删除按钮根据id删除信息
router.delete('/dinfo/:id', (req, res) => {
  const id = req.params.id;
  const dQuery =  `delete from userinfo where id = ?`  ;
  // console.log(id);
  db.query(dQuery,id,(err,result)=>{
      if(err){return err;}
      else{
        res.json({ status: 200, message: '成功', result });
      }
  })
});





// 调用 app.listen 方法，指定端口号并启动web服务器
app.listen(5500, function () {
  console.log('api server running at http://127.0.0.1:5500')
})