/* eslint-disable @typescript-eslint/naming-convention */
export const templates: { [key: string]: string } = {
    "Smash": `# 测试 PE.垫材24 旧PDc解的砸率
scene:PE
protect:18 28 58 68  # 要保护的炮位
repeat:10000         # 测试选卡数 (可省略, 默认 10000), 每波 5 只红眼

w 601
PP 225 25 9
C 539~619 1265 9

w 601
PP 225 25 9
DD +107 15 8.1875
C 539~619 1256 9

w 601
PP 225 25 9
DD +107 15 8.1875
C 539~619 1256 9`,
    "Explode": `# 测试 NE 无铲炮伤 (分别于 776, 800, 824 垫的三种情况)
scene:NE
protect:18 28 38 48 58  # 要保护的炮位
repeat:10000            # 测试波数 (可省略, 默认 10000), 每波梯/丑/橄/篮各 5 只

SET x 776

w1~3 0 1200~1500        # 完美预判冰, 记录 1200~1500cs 的数据, 共三种情况
C_NUM x+266 1"234'5' 9
SET x x+24`,
    "Refresh": `# 测试红白关 225 / 260 PP 刷新意外率
scene:PE
require:红白            # 必出的僵尸类型, 可用中文单字或英文四字缩写
# ban: ...             # 禁出的僵尸类型
huge:false             # true 为旗帜波, false 为普通波
activate:true          # true 为激活, false 为分离
dance:true             # true 为使用 dance cheat, false 为不使用
natural:true           # true 为自然出怪, false 为均匀出怪
repeat:1000            # 测试选卡数 (可省略, 默认 1000)

w 601
PP 225 25 9

w 601
PP 260 25 9`,
    "Pogo": `# 测试后院有 5炮 7炮 时全收跳跳的最大波次
scene:PE
protect:15 17   # 场上存在的炮, 只有列数会被用到, 无需提供多行
repeat:1000     # 测试波数 (可省略, 默认 1000), 每波 1000 只跳跳

w 0 1200~1800   # 完美预判冰, 记录 1200~1800cs 的数据
    # 如果测试屋顶场合, 这里需要加一个用炮操作
    # 如 P3 300 2 9, 代表考虑的炮尾列 (其它参数不会用到)`,
    "Pos": `# 测试 PE 红眼在 445 垫接预判冰时的坐标分布
scene:PE
types:红                # 测试的僵尸类型, 可用中文单字或英文四字缩写
repeat:20000            # 测试波数 (可省略, 默认 20000)
# targetPos:700         # 目标整数坐标, 可为负 (可省略), 提供后改为测试僵尸到达该坐标的时刻分布

w 601 900               # 601 冰，记录 900cs 时的数据
C 445+200 1256 9`,
    "Imp": `# 测试弦14炮拦截失败率
scene:PE
types:红白          # 测红白同出；可改为 红 或 白
impIndex:ratio 0.5  # 小鬼高/低编号各半；可改为 high 或 low
# protect:13 15 24 54 63 65 # 可选：要统计小鬼啃食伤害的保护植物
repeat:20000

# 7.1125 伤红 全拦白
# 7.1 不伤红 漏拦白

w 875
PP 675 25 8.225
DD +116 15 7.1125

w 875
PP 675 25 8.225
DD +116 15 7.1125`,
};
