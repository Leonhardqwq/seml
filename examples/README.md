# SEML 测试示例

先编译：

```powershell
npm run compile
```

运行：

```powershell
npm run eg:test -- <类型> <seml文件>
```

或在package.json中的`scripts`里运行`eg:test`

类型：

| 类型 | 功能 |
| --- | --- |
| `smash` | 砸率 |
| `explode` | 炮伤 |
| `refresh` | 刷新 |
| `pogo` | 跳跳 |
| `pos` | 坐标分布 |
| `imp` | 小鬼拦截 |

例子：

```powershell
npm run eg:test -- pos examples/丑.seml
npm run eg:test -- pos examples/篮_冰波分离.seml
npm run eg:test -- imp examples/imp.seml
npm run eg:test:list
```

结果输出到 `examples/dest`。
