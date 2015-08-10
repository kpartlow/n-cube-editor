package com.cedarsoftware.controller

import com.cedarsoftware.dto.User
import com.cedarsoftware.service.ncube.IUserService
import groovy.transform.CompileStatic
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger

/**
 * Use to manage application user.
 *
 * @author John DeRegnaucourt (jdereg@gmail.com)
 *         <br/>
 *         Copyright (c) Cedar Software LLC
 *         <br/><br/>
 *         Licensed under the Apache License, Version 2.0 (the "License");
 *         you may not use this file except in compliance with the License.
 *         You may obtain a copy of the License at
 *         <br/><br/>
 *         http://www.apache.org/licenses/LICENSE-2.0
 *         <br/><br/>
 *         Unless required by applicable law or agreed to in writing, software
 *         distributed under the License is distributed on an "AS IS" BASIS,
 *         WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *         See the License for the specific language governing permissions and
 *         limitations under the License.
 */
@CompileStatic
class UserController
{
	private static final Logger LOG = LogManager.getLogger(UserController.class);
    private IUserService _service;

	UserController(IUserService service)
	{
		_service = service
	}

	private IUserService getUserService()
	{
		return _service
	}

	Object[] getUserOption(String key)
	{
		if (key == null || key.length() < 1)
		{
			return null
		}

        return [] as Object[]
//		List<Object[]> options = getUserService().getValue(getHID(), key);
//		if (options == null || options.size() < 1)
//		{
//			return null;
//		}
//		return options.toArray();
	}

	void setUserOption(String key, String value)
	{
		if (key == null || key.length() < 1)
		{
			return
		}
//		getUserService().setValue(getHID(), key, value);
	}

	User getUser(String userId)
	{
		if (userId == null || userId.length() < 1)
		{
			return null
		}
        return null
//		return getUserService().getUser(userId);
    }
}
