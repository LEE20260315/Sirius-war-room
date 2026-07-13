// === 基本面维度配置共享模块 ===
// 从 pages/fundamental.html 内联脚本抽出，供 fundamental.html 及未来其他页面复用。
// 定义 FUND_DIMENSION_CONFIG（维度/指标映射/品种模板/权重/拒绝阈值）+ mapIndicatorToDim 前缀匹配 + validateConfig 开发态校验。
(function () {
  'use strict';

  var FUND_DIMENSION_CONFIG = {
    dimensions: [
      { key: 'macro',     name: '宏观环境', inputId: 'fundMacro',     noteId: 'fundMacroNote' },
      { key: 'supply',    name: '供需格局', inputId: 'fundSupply',    noteId: 'fundSupplyNote' },
      { key: 'inventory', name: '库存水平', inputId: 'fundInventory', noteId: 'fundInventoryNote' },
      { key: 'basis',     name: '基差结构', inputId: 'fundBasis',     noteId: 'fundBasisNote' },
      { key: 'technical', name: '技术形态', inputId: 'fundTechnical', noteId: 'fundTechnicalNote' }
    ],
    indicatorToDimension: {
      macro:     ['FRED', 'DXY', 'GPR', 'VIX'],           // 前缀匹配
      supply:    ['ONI', 'ENSO_FORECAST', 'MPOB_STOCK', 'WASDE_STOCK'],
      inventory: ['COMEX', 'LME', 'DOMESTIC_INV', 'COT']
    },
    varietyTemplates: {
      '棕榈油': 'agri', '天然橡胶': 'agri', '白糖': 'agri', '橡胶': 'agri',
      '黄金': 'metal', '白银': 'metal', '铜': 'metal',
      '碳酸锂': 'lightweight', '螺纹钢': 'lightweight', '玻璃': 'lightweight', '多晶硅': 'lightweight'
    },
    templates: {
      agri: {
        dims: { supply: 0.35, inventory: 0.30, macro: 0.15, basis: 0.10, technical: 0.10 },
        note: ''
      },
      metal: {
        // 五维均计入 totalWeight，使 grayOut 的四维参与"有效维度权重占比"分母；
        // 仅宏观有效时 validWeight/totalWeight = 0.2 < refuseThreshold → 触发拒绝出分
        dims: { macro: 0.2, supply: 0.2, inventory: 0.2, basis: 0.2, technical: 0.2 },
        note: '当前为宏观情绪分，非品种基本面',
        grayOut: ['supply', 'inventory', 'basis', 'technical']  // 标灰"无品种级数据源"
      },
      lightweight: {
        dims: {},
        note: '⚠ 轻量模组，仅供参考',
        isLightweight: true
      }
    },
    refuseThreshold: 0.5
  };

  // 预排序 indicatorToDimension 前缀（按长度降序，避免短前缀误匹配）
  var _PREFIX_ENTRIES = [];
  Object.keys(FUND_DIMENSION_CONFIG.indicatorToDimension).forEach(function (dim) {
    FUND_DIMENSION_CONFIG.indicatorToDimension[dim].forEach(function (p) {
      _PREFIX_ENTRIES.push({ prefix: p, dim: dim });
    });
  });
  _PREFIX_ENTRIES.sort(function (a, b) { return b.prefix.length - a.prefix.length; });

  // 指标名 → 维度 key（前缀匹配，已按长度降序）
  function mapIndicatorToDim(name) {
    if (!name) return null;
    for (var i = 0; i < _PREFIX_ENTRIES.length; i++) {
      if (name.indexOf(_PREFIX_ENTRIES[i].prefix) === 0) return _PREFIX_ENTRIES[i].dim;
    }
    return null;
  }

  // 开发态配置结构校验：维度 key 唯一 / 模板权重非负 / 品种映射指向已定义模板 / 前缀无跨维度冲突
  function validateConfig() {
    var cfg = FUND_DIMENSION_CONFIG;
    var problems = [];

    // 1. 维度 key 唯一
    var seenKeys = {};
    cfg.dimensions.forEach(function (d) {
      if (seenKeys[d.key]) problems.push('维度 key 重复: ' + d.key);
      seenKeys[d.key] = true;
    });

    // 2. 模板权重非负 + dims 中的 key 引用已定义维度
    var dimKeySet = {};
    cfg.dimensions.forEach(function (d) { dimKeySet[d.key] = true; });
    Object.keys(cfg.templates).forEach(function (tplName) {
      var tpl = cfg.templates[tplName];
      var dims = tpl.dims || {};
      Object.keys(dims).forEach(function (dk) {
        if (!dimKeySet[dk]) problems.push('模板 ' + tplName + ' 引用了未定义维度: ' + dk);
        if (typeof dims[dk] !== 'number' || dims[dk] < 0) problems.push('模板 ' + tplName + ' 维度 ' + dk + ' 权重非正数: ' + dims[dk]);
      });
    });

    // 3. 品种映射指向已定义模板
    Object.keys(cfg.varietyTemplates).forEach(function (v) {
      var tn = cfg.varietyTemplates[v];
      if (!cfg.templates[tn]) problems.push('品种 ' + v + ' 映射到未定义模板: ' + tn);
    });

    // 4. 前缀无跨维度冲突：某前缀是另一维度更长前缀的子串（可能导致误匹配）
    _PREFIX_ENTRIES.forEach(function (a) {
      _PREFIX_ENTRIES.forEach(function (b) {
        if (a.dim !== b.dim && b.prefix.indexOf(a.prefix) === 0 && a.prefix.length < b.prefix.length) {
          // b.prefix 以 a.prefix 开头且更长，属于正常的前缀分层（如 FRED vs FRED_2YR_YIELD 同维度则 OK）
          // 仅当跨维度时 warn
          problems.push('前缀可能冲突: "' + a.prefix + '"(' + a.dim + ') 是 "' + b.prefix + '"(' + b.dim + ') 的前缀');
        }
      });
    });

    if (problems.length > 0) {
      console.warn('[FUND_DIMENSION_CONFIG] 校验发现问题:\n' + problems.join('\n'));
    }
    return problems;
  }

  // 暴露到全局
  window.FUND_DIMENSION_CONFIG = FUND_DIMENSION_CONFIG;
  window.mapIndicatorToDim = mapIndicatorToDim;
  window.validateFundDimConfig = validateConfig;

  // 开发态自动校验
  var host = (typeof location !== 'undefined') ? location.hostname : '';
  if (host === 'localhost' || host === '127.0.0.1') {
    validateConfig();
  }
})();
