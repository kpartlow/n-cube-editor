package com.cedarsoftware.util

import com.cedarsoftware.ncube.ApplicationID
import com.cedarsoftware.ncube.NCube
import com.cedarsoftware.ncube.RuleInfo
import com.google.common.base.Splitter
import static com.cedarsoftware.util.RpmVisualizerConstants.*
import groovy.transform.CompileStatic

/**
 * Holds information about a source cube and target cube for purposes of creating a visualization of the cubes and their relationship.
 */

@CompileStatic
class RpmVisualizerRelInfo extends VisualizerRelInfo
{
	protected RpmVisualizerHelper helper = new RpmVisualizerHelper()
	String sourceFieldRpmType

	RpmVisualizerRelInfo() {}

	RpmVisualizerRelInfo(ApplicationID appId, Map node)
	{
		super(appId, node)
	}

	Set<String> getRequiredScope()
	{
		Set<String> requiredScope = super.requiredScope
		requiredScope.remove(AXIS_FIELD)
		requiredScope.remove(AXIS_NAME)
		requiredScope.remove(AXIS_TRAIT)
		return requiredScope
	}

	@Override
	String getDetails(VisualizerInfo visInfo)
	{
		String effectiveName = effectiveNameByCubeName
		StringBuilder sb = new StringBuilder()
		String notesLabel = "<b>Note: </b>"

		if (false == cellValuesLoaded)
		{
			sb.append("<b>*** Unable to load fields and traits for ${effectiveName}</b>${DOUBLE_BREAK}")
			notesLabel = "<b>Reason: </b>"
		}

		//Notes
		if (notes)
		{
			sb.append(notesLabel)
			notes.each { String note ->
				sb.append("${note} ")
			}
			sb.append("${DOUBLE_BREAK}")
		}

		//Scope
		if (cellValuesLoaded)
		{
			String title = showAllCellValues ? 'Utilized scope' : 'Utilized scope to load class without all traits'
			getDetailsMap(sb, title, targetScope)
		}
		getDetailsMap(sb, 'Available scope', scope)

		//Fields
		if (cellValuesLoaded)
		{
			if (showAllCellValues)
			{
				addClassTraits(sb)
			}
			addFieldDetails(sb)
		}
		return sb.toString()
	}

	private void addFieldDetails(StringBuilder sb)
	{
		if (showAllCellValues)
		{
			sb.append("<b>Fields and traits</b>")
		}
		else
		{
			sb.append("<b>Fields</b>")
		}
		sb.append("<pre><ul>")
		targetCellValues.each { String fieldName, v ->
			if (CLASS_TRAITS != fieldName)
			{
				if (showAllCellValues)
				{
					sb.append("<li><b>${fieldName}</b></li>")
					addTraits(sb, fieldName)
				}
				else
				{
					sb.append("<li>${fieldName}</li>")
				}
			}
		}
		sb.append("</ul></pre>")
	}

	private void addTraits(StringBuilder sb, String fieldName)
	{
		Map<String, Object> traits = targetCellValues[fieldName].sort() as Map
		sb.append("<pre><ul>")
		traits.each { String traitName, Object traitValue ->
			if (traitValue != null)
			{
				String traitString = traitValue.toString()
				if (traitString.startsWith(HTTP) || traitString.startsWith(HTTPS) || traitString.startsWith(FILE))
				{
					sb.append("""<li>${traitName}: <a href="#" onclick='window.open("${traitString}");return false;'>${traitString}</a></li>""")
				}
				else
				{
					sb.append("<li>${traitName}: ${traitValue}</li>")
				}
			}
		}
		sb.append("</ul></pre>")
	}

	private void addClassTraits(StringBuilder sb)
	{
		sb.append("<b>Class traits</b>")
		addTraits(sb, CLASS_TRAITS)
		sb.append("${BREAK}")
	}

	@Override
	String getGroupName(VisualizerInfo visInfo, String cubeName = targetCube.name)
	{
		Iterable<String> splits = Splitter.on('.').split(cubeName)
		String group = splits[2].toUpperCase()
		return visInfo.allGroupsKeys.contains(group) ? group : UNSPECIFIED
	}

	@Override
	String getSourceEffectiveName()
	{
		String scopedName = sourceScopedName
		return scopedName == null ? sourceCube.name : scopedName
	}

	@Override
	String getTargetEffectiveName()
	{
		String scopedName = targetScopedName
		return scopedName == null ? targetCube.name : scopedName
	}

	String getSourceScopedName()
	{
		Map<String, Object> classTraitsTraitMap = sourceCellValues[CLASS_TRAITS] as Map
		return classTraitsTraitMap ? classTraitsTraitMap[R_SCOPED_NAME] : null
	}

	String getTargetScopedName()
	{
		Map<String, Object> classTraitsTraitMap = targetCellValues[CLASS_TRAITS] as Map
		return classTraitsTraitMap ? classTraitsTraitMap[R_SCOPED_NAME] : null
	}

	@Override
	String getNextTargetCubeName(String targetFieldName)
	{
		if (sourceCube.getAxis(AXIS_TRAIT).findColumn(R_SCOPED_NAME))
		{
			String scopedName = sourceCellValues[CLASS_TRAITS][R_SCOPED_NAME]
			return !scopedName ?: RPM_CLASS_DOT + sourceFieldRpmType
		}
		return RPM_CLASS_DOT + targetFieldName
	}

	@Override
	String getSourceMessage()
	{
		if (sourceCellValues)
		{
			return sourceScopedName ? ", the target of ${sourceScopedName} on ${getCubeDisplayName(sourceCube.name)}" : ""
		}
		return ''
	}

	@Override
	void loadCellValues(ApplicationID appId, VisualizerInfo visInfo)
	{
		cellValuesLoaded = null
		targetCellValues = [:]
		Map output = [:]
		if (targetCube.name.startsWith(RPM_ENUM))
		{
			helper.loadRpmClassFields(appId, RPM_ENUM, targetCube.name - RPM_ENUM_DOT, scope, targetCellValues, showAllCellValues, output)
		}
		else
		{
			helper.loadRpmClassFields(appId, RPM_CLASS, targetCube.name - RPM_CLASS_DOT, scope, targetCellValues, showAllCellValues, output)
		}
		removeNotExistsFields()
		addRequiredAndOptionalScopeKeys(visInfo)
		retainUsedScope(visInfo, output)
		cellValuesLoaded = true
	}

	void retainUsedScope(VisualizerInfo visInfo, Map output)
	{
		Set<String> scopeCollector = new CaseInsensitiveSet<>()
		scopeCollector.addAll(visInfo.requiredScopeKeys[targetCube.name])
		scopeCollector.addAll(visInfo.optionalScopeKeys[targetCube.name])
		scopeCollector << EFFECTIVE_VERSION_SCOPE_KEY

		RuleInfo ruleInfo = NCube.getRuleInfo(output)
		Set keysUsed = ruleInfo.getInputKeysUsed()
		scopeCollector.addAll(keysUsed)

		targetScope = new CaseInsensitiveMap(scope)
		cullScope(targetScope.keySet(), scopeCollector)
	}

	void removeNotExistsFields()
	{
		targetCellValues.keySet().removeAll { String fieldName -> !targetCellValues[fieldName][R_EXISTS] }
	}

	static void cullScope(Set<String> scopeKeys, Set scopeCollector)
	{
		scopeKeys.removeAll { String item -> !(scopeCollector.contains(item) || item.startsWith(SYSTEM_SCOPE_KEY_PREFIX)) }
	}

	@Override
	Map<String, Object> createEdge(int edgeId)
	{
		Map<String, Object> edge = super.createEdge(edgeId)
		Map<String, Map<String, Object>> sourceCellValues = sourceCellValues

		Map<String, Map<String, Object>> sourceFieldTraitMap = sourceCellValues[sourceFieldName] as Map
		String vMin = sourceFieldTraitMap[V_MIN] as String ?: '0'
		String vMax = sourceFieldTraitMap[V_MAX] as String ?: '999999'

		if (targetCube.name.startsWith(RPM_ENUM_DOT))
		{
			edge.label = sourceFieldName
			edge.title = "Field ${sourceFieldName} cardinality ${vMin}:${vMax}".toString()
		}
		else
		{
			edge.title = "Valid value ${sourceFieldName} cardinality ${vMin}:${vMax}".toString()
		}

		return edge
	}

	@Override
	Map<String, Object> createNode(VisualizerInfo visInfo, String group = null)
	{
		Map<String, Object> node = super.createNode(visInfo, group)
		if (targetCube.name.startsWith(RPM_ENUM_DOT))
		{
			node.label = null
			node.detailsTitle2 = null
			node.title = node.detailsTitle1
			node.typesToAdd = null
		}
		return node
	}

	@Override
	protected String getNodeLabel()
	{
		getDotSuffix(targetEffectiveName)
	}

	@Override
	String getEffectiveNameByCubeName()
	{
		String scopeKey = getDotSuffix(targetCube.name)
		return scope[scopeKey] ?: targetEffectiveName
	}

	@Override
	String getCubeDisplayName(String cubeName)
	{
		String displayName
		if (cubeName.startsWith(RPM_CLASS_DOT))
		{
			displayName = cubeName - RPM_CLASS_DOT
		}
		else if (cubeName.startsWith(RPM_ENUM_DOT))
		{
			displayName = cubeName - RPM_ENUM_DOT
		}
		return displayName
	}

	@Override
	String getSourceDescription()
	{
		String description
		String sourceCubeName = sourceCube.name
		if (sourceCubeName.startsWith(RPM_CLASS_DOT))
		{
			description = getDotSuffix(sourceEffectiveName)
		}
		else if (sourceCubeName.startsWith(RPM_ENUM_DOT))
		{
			if (targetScopedName)
			{
				String sourceDisplayName = getCubeDisplayName(sourceCubeName)
				String scopeKeyForSourceOfSource = getDotPrefix(sourceDisplayName)
				String nameOfSourceOfSource = sourceScope[scopeKeyForSourceOfSource]
				String fieldNameSourceOfSource = sourceScope[SOURCE_FIELD_NAME]
				description = "field ${fieldNameSourceOfSource} on ${nameOfSourceOfSource}".toString()
			}
			else{
				description = getCubeDisplayName(sourceCubeName)
			}
		}
		return description
	}

	@Override
	String getCubeDetailsTitle1()
	{
		String detailsTitle
		String targetCubeName = targetCube.name
		if (targetCubeName.startsWith(RPM_CLASS_DOT))
		{
			detailsTitle = getCubeDisplayName(targetCubeName)
		}
		else if (targetCubeName.startsWith(RPM_ENUM_DOT))
		{
			String sourceName =  sourceCellValues ? getDotSuffix(sourceEffectiveName) : getCubeDisplayName(sourceCube.name)
			detailsTitle = "Valid values for field ${sourceFieldName} on ${sourceName}".toString()
		}
		return detailsTitle
	}

	@Override
	String getCubeDetailsTitle2()
	{
		if (targetCube.name.startsWith(RPM_CLASS_DOT) && targetScopedName)
		{
			return effectiveNameByCubeName
		}
		return null
	}
}