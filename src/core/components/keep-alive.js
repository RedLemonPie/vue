/* @flow */

import { isRegExp, remove } from 'shared/util'

import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };
//获取组件名称
//返回组件options.name 如无,则返回tag
function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}
// 匹配规则
function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

//修剪缓存
function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}
// ^入口
function pruneCacheEntry (
  cache: VNodeCache,
  key: string,
  keys: Array<string>,
  current?: VNode
) {
  const cached = cache[key]
  //如果有缓存,不是当前的且缓存tag和当前不一致,则销毁
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  
  cache[key] = null
  //从key中移除
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  //抽象组件
  abstract: true,
  
  props: {
    include: patternTypes,
    exclude: patternTypes,
    max: [String, Number]
  },

  created () {
    //key 和 缓存  
    this.cache = Object.create(null)
    this.keys = []
  },
  
  //销毁组件时调用
  destroyed () {
    //
    for (const key in this.cache) {
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },
  //通过name监听包含和排除
  mounted () {
    this.$watch('include', val => {
      pruneCache(this, name => matches(val, name))
    })
    this.$watch('exclude', val => {
      pruneCache(this, name => !matches(val, name))
    })
  },
  render () {
    // $slots.default表示slot中的所有子组件（包括换行）
    const slot = this.$slots.default
    //获取第一个节点
    const vnode: VNode = getFirstComponentChild(slot)
    
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    // 获取组件选项
    const vnode: VNode = getFirstComponentChild(slot)
    if (componentOptions) {
      // check pattern
     // 判断组件选项是否包含name,如果是,则返回获取到的组件子节点
      const name: ?string = getComponentName(componentOptions)
      const { include, exclude } = this
      if (
        // not included
        (include && (!name || !matches(include, name))) ||
        // excluded
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }
      // 
      const { cache, keys } = this
      //判断节点是否存在key
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
      //如果不存在key,则key为option
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      //如果缓存中有这个节点
      if (cache[key]) {
        //移除节点再加入节点到最后
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else {
        //直接插入节点
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        //如果超过缓存数量,则调用删减节点
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }
      // 节点的data的keepAlive设置为真
      vnode.data.keepAlive = true
    }
    return vnode || (slot && slot[0])
  }
}
